import { HfInference } from '@huggingface/inference';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors'
import http from 'http'
import { Server } from 'socket.io'
import { error } from 'console';

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

const hfApiToken = process.env.API_TOKEN;
const model = 'HuggingFaceH4/zephyr-7b-beta';

const inference = new HfInference(hfApiToken);

app.use(express.json());
app.use(cors())

async function queryHuggingFaceAPI(userMessage) {
    try {
        let responseText = '';

        // Use a for-await-of loop to handle the streaming response
        for await (const chunk of inference.chatCompletionStream({
            model: model,
            messages: [{ role: 'user', content: userMessage }],
            max_tokens: 500,
        })) {
            // Append the chunk's content to the response text
            responseText += chunk.choices[0]?.delta?.content || '';
        }

        return responseText;
    } catch (error) {
        console.error('Error querying the API:', error);
        return null;
    }
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
            const streamingResponse = await queryHuggingFaceAPI(msg);
            socket.emit('chatReceiveMessage', { response: streamingResponse })
        } catch(err) {
            console.error('Error: ', err);
            socket.emit('chatError', {error: 'An error occurred.'})
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
            const streamingResponse = await queryHuggingFaceAPI(voice);
            socket.emit('voiceReceiveMessage', { response: streamingResponse })
        } catch(err) {
            console.log('Error :', err);
            socket.emit('voiceError', {error: 'An error occurred'})
        }
    })

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    })
})

// app.post('/chat', async(req, res) => {
//     const {msg} = req.body;

//     try{
//         const streamingResponse = await queryHuggingFaceAPI(msg)
//         res.json({ response: streamingResponse})
//     } catch(err) {
//         console.log('Error: ', err);
//         res.status(500).json({err: 'An Error occured..'});
//     }
// })

server.listen(port, ()=>{
    console.log(`Server is listening at ${port}`)
})