import React, { useEffect, useRef, useState } from 'react'
import io from 'socket.io-client'
import { FaMicrophone } from "react-icons/fa6"


const Voice = () => {
    
    const [botChat, setBotChat] = useState('')
    const [speechText, setSpeechText] = useState('')
    const [isTyping, setIsTyping] = useState(false)
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef(null);
    const speechSynthesisRef = useRef(window.speechSynthesis);
    const socketRef = useRef(null);

    useEffect(() => {

        socketRef.current = io('https://mobishaala-chatbot.onrender.com')

        socketRef.current.on('voiceReceiveMessage', (data) => {
            // console.log(data)
            if(data.response){
                handleTypingAndSpeechEffect(data.response)
            }
        });

        socketRef.current.on('voiceError', (err) => {
            console.log('Error :', err)
        });

        return () => {
            socketRef.current.close()
        }
    }, [])

    const handleMicOnClick = () => {
        setIsListening(true);
        setBotChat('')
        setSpeechText('')
        recognitionRef.current.start();
    };

    const handleMicOnRelease = () => {
        recognitionRef.current.stop();
        setIsListening(false);
        setIsTyping(false);
        setBotChat('')
    }

    const speak = (speechInput) => {
        // console.log(speechInput)
        let msg = new SpeechSynthesisUtterance();
        msg.volume = 1;
        msg.rate = 1;
        msg.pitch = 1;
        msg.text = speechInput;
        msg.lang = 'en-US';

        speechSynthesisRef.current.speak(msg);
    }

    const handleTypingAndSpeechEffect = (text) => {
        setIsTyping(true)
        setBotChat('')

        speak(text)
        let index = 0;

        const intervalId = setInterval(() => {
            setBotChat((prev) => prev+text[index-1])
            index++

            if(index === text.length - 1){
                clearInterval(intervalId)
            }
        }, 50)
    }

    useEffect(() => {
        // Initialize the SpeechRecognition object
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            const recognition = new SpeechRecognition();
            recognitionRef.current = recognition;

            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            let finalTranscript = '';
            recognition.onresult = (event) => {
                let interimTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript + ' ';
                    } else {
                        interimTranscript += transcript;
                    }
                }
                // finalTranscript = finalTranscript + interimTranscript
                finalTranscript = finalTranscript.trim().replace(/\.+$/, '')
                setSpeechText(finalTranscript)
            };

            recognition.onend = () => {
                socketRef.current.emit('voiceSendMessage', { voice : finalTranscript });
                finalTranscript = ''
            }

            recognition.onerror = (event) => {
                console.error('Speech recognition error', event.error);
            };

            return () => {
                recognition.stop();
            };
    }, []);

  return (
    <div className='h-[95vh] w-[100vw] flex flex-col justify-center items-center'>
        <div className='h-[100%] w-[70%] flex flex-col justify-end items-center mb-16'>
            <p className='w-[100%] flex justify-end'>{speechText}<b>: User</b></p>
            {
                botChat && (
                    (isTyping) ? (
                        <p className='flex justify-start w-[90%]'><b>Bot:</b>{botChat}</p>
                    ) : (
                        <p className='flex justify-start w-[90%]'><b>Bot:</b> Typing...</p>
                    )
                )
            }
        </div>
        <div>
            <button onMouseDown={handleMicOnClick} onMouseUp={handleMicOnRelease} className={isListening ? 'bg-slate-200 rounded-full p-2' : 'bg-slate-400 rounded-full p-2'}>
                <FaMicrophone className='text-xl'/>
            </button>
        </div>
    </div>
  )
}

export default Voice
