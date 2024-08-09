import { HfInference } from '@huggingface/inference';
import dotenv from 'dotenv';
import express, { response } from 'express';
import cors from 'cors'
import http from 'http'
import { Server } from 'socket.io'
import OpenAI from 'openai';
import { createClient } from '@deepgram/sdk';
import fs from 'fs'
import path from 'path'

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;
const __dirname = path.resolve()

const hfApiToken = process.env.HUGG_API_TOKEN;
const nvidiaApiToken = process.env.NVIDIA_OPEN_AI;
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
// const model = 'HuggingFaceH4/zephyr-7b-beta';

const openai = new OpenAI({
    apiKey: nvidiaApiToken,
    baseURL: 'https://integrate.api.nvidia.com/v1',
})

app.use(express.json());
app.use(cors())
app.use(express.static(path.join(__dirname, 'public')));

async function nvidia_meta(prompt) {
    try{
        let responseText = '';
        let characterCount = 0;

        const completion = await openai.chat.completions.create({
          model: "meta/llama-3.1-8b-instruct",
          messages: [{"role":"user","content": prompt}],
          temperature: 0.2,
          top_p: 0.7,
          max_tokens: 1024,
          stream: true
        })
    
        for await (const chunk of completion) {
          responseText += chunk.choices[0]?.delta?.content || '';
        }

        return responseText
    } catch(err){
        console.error('Error in querying the api: ', err)
        return null;
    }
}

async function speechToTextConverter(buffer) {
    // const data = fs.readFileSync(filePath);
    // console.log(data)
    try {
        const response = await fetch("https://api-inference.huggingface.co/models/openai/whisper-medium.en", {
            headers: { Authorization: `Bearer ${hfApiToken}` },
            method: "POST",
            body: buffer
        });
        const result = await response.json();
        return result.text;
    } catch (error) {
        console.error("Error in speech-to-text conversion:", error);
        throw error;
    }
}

function splitTextIntoChunks(text, maxChunkSize) {
    const chunks = [];
    let currentChunk = '';

    text.split(/\s+/).forEach(word => {
        // Check if adding the next word would exceed the chunk size
        if ((currentChunk + word).length > maxChunkSize) {
            chunks.push(currentChunk.trim()); // Add the current chunk to the list
            currentChunk = ''; // Reset the current chunk
        }

        // Add the word to the current chunk
        currentChunk += word + ' ';
    });

    // Add the last chunk if it's not empty
    if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
})

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('chatSendMessage', async(data) => {
        const {msg} = data;

        if(!msg){
            socket.emit('chatError', {error: 'chat Text is required'});
            return;
        }

        try {
            const streamingResponse = await nvidia_meta(msg);
            socket.emit('chatReceiveMessage', { response: streamingResponse })
        } catch(err) {
            console.error('Error: ', err);
            socket.emit('chatError', {error: 'An error occurred in generating text in chatbot'})
        }
    });

    socket.on('voiceSendMessage', async(data) => {
        const { voice } = data;
        console.log(voice)

        if(!voice){
            socket.emit('voiceError', {error: 'voice msg is required'});
            return;
        }

        try{
            const streamingResponse = await nvidia_meta(voice);
            if(streamingResponse !== undefined){
                socket.emit('voiceReceiveMessage', { response: streamingResponse })
            } else {
                socket.emit('voiceReceiveMessage', { response : undefined })
            }

            const chunks = splitTextIntoChunks(streamingResponse, 500);

            for (const chunk of chunks) {
                console.log(chunk)
                try {
                    const response = await deepgram.speak.request(
                        { text : chunk },
                        {
                          model: "aura-helios-en",
                          encoding: "linear16",
                          container: "wav",
                          stream: true,
                        }
                    );
                    const stream = await response.getStream();
                    if (stream) {
                        const reader = stream.getReader();
    
                        let done = false;
                        let totalData = new Uint8Array();
    
                        while (!done) {
                          const { value, done: streamDone } = await reader.read();
                          done = streamDone;
    
                          if (value) {
                            // socket.emit('textToSpeechReceived', { response : value });
    
                            totalData = new Uint8Array([...totalData, ...value]);
                          }
                        }

                        console.log(totalData.buffer)
                        
                        socket.emit('textToSpeechReceived', { buffer: Buffer.from(totalData.buffer) });
    
                        // await fs.writeFile("output.wav", Buffer.from(totalData.buffer), (err) => {
                        //     if (err) {
                        //       console.error("Error writing audio to file:", err);
                        //     } else {
                        //       console.log("Audio file written to output.wav");
                        //     }
    
                        //     fs.readFile('output.wav', (err, data) => {
                        //         if (err) {
                        //           socket.emit('speechToTextError', { error: 'File read error' });
                        //         } else {
                        //           socket.emit('textToSpeechReceived', { buffer: data });
                        //         }
                        //     });
                        // });

                        // await new Promise(resolve => {
                        //     socket.once('audioPlaybackFinished', resolve);
                        // });
    
                    } else {
                        socket.emit('speechToTextError', { error: 'Failed to create audio stream.' });
                    }
    
                    // app.get('/output.wav', (req, res) => {
                    //     res.sendFile(path.join(__dirname, 'output.wav'));
                    // });
                } catch(err) {
                    console.log('Error :', err);
                    socket.emit('speechToTextError', {error: 'An error occurred in text to speech'})
                }
            }
        } catch(err) {
            console.log('Error :', err);
            socket.emit('voiceError', {error: 'An error occurred in text Generation in voice bot'})
        }
    });

    socket.on('speechToTextMsgSend', async(data) => {
        const {voiceRecord} = data;

        if(!voiceRecord){
            socket.emit('speechToTextError', { Error: 'record the voice' });
            return;
        }

        try{
            const buffer = Buffer.from(voiceRecord);
            const response = await speechToTextConverter(buffer)
            socket.emit('speechToTextMsgReceived', { response : response })
        } catch(err) {
            console.log('Error :', err);
            socket.emit('speechToTextError', {error: 'An error occurred in speech to text'})
        }
    })

    // socket.on('textToSpeechSend', async(data) => {
    //     const {text} = data;
    //     console.log(text)

    //     if(!text){
    //         socket.emit('speechToTextError', { Error: 'Error in converting the text to speech' });
    //         return;
    //     }

    //     const chunks = splitTextIntoChunks(text, 1000);

    //     for (const chunk of chunks) {
    //         try {
    //             const response = await deepgram.speak.request(
    //                 { text : chunk },
    //                 {
    //                   model: "aura-helios-en",
    //                   encoding: "linear16",
    //                   container: "wav",
    //                   stream: true,
    //                 }
    //             );
    //             const stream = await response.getStream();
    //             if (stream) {
    //                 const reader = stream.getReader();

    //                 let done = false;
    //                 let totalData = new Uint8Array();

    //                 while (!done) {
    //                   const { value, done: streamDone } = await reader.read();
    //                   done = streamDone;

    //                   if (value) {
    //                     // socket.emit('textToSpeechReceived', { response : value });

    //                     totalData = new Uint8Array([...totalData, ...value]);
    //                   }
    //                 }

    //                 await fs.writeFile("output.wav", Buffer.from(totalData.buffer), (err) => {
    //                     if (err) {
    //                       console.error("Error writing audio to file:", err);
    //                     } else {
    //                       console.log("Audio file written to output.wav");
    //                     }

    //                     fs.readFile('output.wav', (err, data) => {
    //                         if (err) {
    //                           socket.emit('speechToTextError', { error: 'File read error' });
    //                         } else {
    //                           socket.emit('textToSpeechReceived', { buffer: data });
    //                         }
    //                     });
    //                 });

    //             } else {
    //                 socket.emit('speechToTextError', { error: 'Failed to create audio stream.' });
    //             }

    //             // app.get('/output.wav', (req, res) => {
    //             //     res.sendFile(path.join(__dirname, 'output.wav'));
    //             // });
    //         } catch(err) {
    //             console.log('Error :', err);
    //             socket.emit('speechToTextError', {error: 'An error occurred in text to speech'})
    //         }
    //     }
    // })

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    })
})

server.listen(port, ()=>{
    console.log(`Server is listening at ${port}`)
})





// code for creating a file and storing it with in the code folders

// import fs from 'fs';
// import path from 'path';
// import multer from 'multer';

// const upload = multer({ dest : 'uploads/' })
// const __dirname = path.resolve()

// const filePath = path.join(__dirname, 'uploads', `audio_${Date.now()}.wav`);
//         console.log(filePath)

//         fs.writeFile(filePath, buffer, async (err) => {
//             if (err) {
//               console.error('Error saving file:', err);
//               socket.emit('speechToTextError', 'Error saving file');
//               return;
//             }
      
//             try {
//                 const speechToTextResponse = await speechToTextConverter(filePath);
//                 console.log(speechToTextResponse);
//                 socket.emit('speechToTextMsgReceived', { response: speechToTextResponse });
//               } catch (err) {
//                 console.log('Error:', err);
//                 socket.emit('speechToTextError', { Error: 'An error occurred in speech-to-text conversion' });
//               } finally {
//                 fs.unlink(filePath, (err) => {
//                   if (err) console.error('Error deleting file:', err);
//                 });
//               }
//         });