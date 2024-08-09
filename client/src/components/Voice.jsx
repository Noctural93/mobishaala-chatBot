import React, { useEffect, useRef, useState } from 'react'
import io from 'socket.io-client'
import { Link } from 'react-router-dom'
import { IoChatbubbleEllipses } from "react-icons/io5";
import { TiMicrophone } from 'react-icons/ti';
import sound from '../assets/sound.png';
import noSound from '../assets/no-sound.png';

const Voice = () => {
    
    const [botChat, setBotChat] = useState('typing...')
    const [speechText, setSpeechText] = useState('')
    const [isTyping, setIsTyping] = useState(false)
    const [chatHistory, setChatHistory] = useState([]);
    const [isUserScrolled, setIsUserScrolled] = useState(false);
    const [recording, setRecording] = useState(false);
    const [isMicPopupOpen, setIsMicPopupOpen] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [errorInRecording, setErrorInRecording] = useState(false);
    const [listenToSpeech, setListenToSpeech] = useState(true);
    const [simultaneousSpecchText, setSimultaneousSpecchText] = useState(false);
    const [voiceReceivedMessage, setVoiceReceivedMessage] = useState('');
    const [voiceUrl, setVoiceUrl] = useState([]);
    const [currentAudioIndex, setCurrentAudioIndex] = useState(0);

    const socketRef = useRef(null);
    const chatContainerRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const timerRef = useRef(null);
    const audioRef = useRef(null);
    const isPlayingRef = useRef(false);

    useEffect(() => {
        socketRef.current = io('https://mobishaala-chatbot.onrender.com');

        socketRef.current.on('connect', () => {
            console.log('Connected to server');
        });

        // Speech to text response
        socketRef.current.on('speechToTextMsgReceived', (data) => {
            if(data.response !== undefined) {
                console.log(data.response);
                setChatHistory(prev => [...prev, { "type": 'user', "chat": data.response }]);
                setSpeechText('');
                setVoiceUrl([]);
                setCurrentAudioIndex(0);
                socketRef.current.emit('voiceSendMessage', { voice : data.response})
            } else {
                setErrorInRecording(true);
                setSpeechText("Can't understand, please record once again");
            }
        });

        // Bot response
        socketRef.current.on('voiceReceiveMessage', (data) => {
            // socketRef.current.emit('textToSpeechSend', { text : data.response});
            setIsTyping(true)
            setVoiceReceivedMessage(data.response)
        });

        // Text to speech response
        socketRef.current.on('textToSpeechReceived', (data) => {
            setSimultaneousSpecchText(true);
            const blob = new Blob([data.buffer], { type: 'audio/wav' });
            const audioUrl = URL.createObjectURL(blob);
            setVoiceUrl(prevChunks => [...prevChunks, audioUrl]);
        });

        // Error handling
        socketRef.current.on('voiceError', (err) => {
            console.log('Error:', err);
        });

        return () => {
            socketRef.current.close();
        }
    }, []);

    useEffect(() => {
        if(voiceReceivedMessage && simultaneousSpecchText){
            handleTypingAndSpeechEffect(voiceReceivedMessage)
        }
    }, [voiceReceivedMessage, simultaneousSpecchText]);

    useEffect(() => {
        if (voiceUrl.length > 0 && !isPlayingRef.current && listenToSpeech) {
            playNextAudio();
        }
    }, [voiceUrl, listenToSpeech]);

    const playNextAudio = () => {
        if (currentAudioIndex < voiceUrl.length) {
            isPlayingRef.current = true;
            audioRef.current = new Audio(voiceUrl[currentAudioIndex]);

            audioRef.current.play().catch(err => {
                console.error("Audio play failed:", err);
                isPlayingRef.current = false;
            });

            audioRef.current.addEventListener('ended', () => {
                isPlayingRef.current = false;
                setCurrentAudioIndex(prevIndex => prevIndex + 1);
            });
        }
    };

    useEffect(() => {
        if (!isPlayingRef.current && currentAudioIndex < voiceUrl.length && listenToSpeech) {
            playNextAudio();
        }
    }, [currentAudioIndex, listenToSpeech]);

    const stopAudio = () => {
        if (audioRef.current && listenToSpeech) {
            audioRef.current.pause(); // Stop the current audio
            audioRef.current.currentTime = 0; // Reset the current audio
            isPlayingRef.current = false; // Mark the audio as stopped
        }
        setCurrentAudioIndex(0); // Reset to the first URL
    };

    const toggleListenToSpeech = () => {
        setListenToSpeech(!listenToSpeech);
        stopAudio();
    };

    // useEffect(() => {
    //     console.log(currentAudioIndex)
    //     if (currentAudioIndex < voiceUrl.length) {
    //         playNextAudio();
    //     }
    // }, [currentAudioIndex, voiceUrl]);

    // const pauseAudio = () => {
    //     if (audioRef.current) {
    //         audioRef.current.pause();
    //         setListenToSpeech(false);
    //     }
    // };

    // const resumeAudio = () => {
    //     if (audioRef.current) {
    //         console.log(audioRef.current)
    //         audioRef.current.play();
    //         setListenToSpeech(true);
    //     }
    // };

    const startRecording = async () => {
        setErrorInRecording(false);
        setIsTyping(false);
        setRecording(true);
        setSpeechText('Listening....');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            mediaRecorderRef.current.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };
            mediaRecorderRef.current.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
                const reader = new FileReader();
                reader.readAsArrayBuffer(audioBlob);
                reader.onloadend = () => {
                    if (socketRef.current) {
                        socketRef.current.emit('speechToTextMsgSend', { voiceRecord: reader.result });
                    }
                };
                audioChunksRef.current = [];
            };
            mediaRecorderRef.current.start();
            console.log("Recording started...");
            timerRef.current = setInterval(() => {
                setRecordingTime(prevTime => prevTime + 1);
            }, 1000);
        } catch (error) {
            console.error("Error accessing microphone:", error);
        }
        scrollToBottom();
    };

    const stopRecording = () => {
        setRecording(false);
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            clearInterval(timerRef.current);
            setRecordingTime(0);
            console.log("Recording stopped....");
            setSpeechText('Processing...');
            setIsMicPopupOpen(!isMicPopupOpen);
        }
    };

    const handleTypingAndSpeechEffect = (text) => {
        setIsTyping(true);
        setBotChat('');

        let index = 0;

        const intervalId = setInterval(() => {
            setBotChat((prev) => prev + text[index - 1]);
            index++;
      
            if (index === text.length - 1 ) {
                setBotChat('typing...');
                clearInterval(intervalId);
                setIsTyping(false);
                setChatHistory(prev => [...prev, { "role": "bot", "chat": text }]);
                setSimultaneousSpecchText(false);
            }
        }, 50);
    };

    const scrollToBottom = () => {
        if(chatContainerRef.current){
            chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' });
        }
    }

    const scrollHandler = () => {
        const { scrollTop, clientHeight, scrollHeight } = chatContainerRef.current;

        if (scrollHeight - scrollTop > clientHeight + 10) {
            setIsUserScrolled(true);
        } else {
            setIsUserScrolled(false);
        }
    };

    useEffect(() => {
        if (!isUserScrolled) {
            scrollToBottom();
        }
    }, [chatHistory, isUserScrolled, setIsUserScrolled, isTyping, botChat]);

    return (
        <div className='h-[100vh] w-[100vw] flex flex-col justify-center items-center relative'>
            <div ref={chatContainerRef} className='w-[100%] h-[80vh] overflow-auto flex items-center justify-center mb-4 mt-4' onScroll={scrollHandler}>
                <div className='flex flex-col items-center w-[70%] h-[80vh] justify-start gap-8'>
                    {chatHistory.map((item, index) => (
                        (item.type === 'user') ? (
                        <div key={index} className='flex justify-end w-[90%]'>
                            <p className='bg-gray-100 p-3 rounded-lg'>{item.chat}<b className='ml-1 text-wrap'> : User</b></p>
                        </div>
                        ) : (
                        <div key={index} className='flex justify-start w-[90%]'>
                            <p className='bg-gray-100 p-3 rounded-lg'><b className='mr-1 text-nowrap'>Bot :</b>{item.chat}</p>
                        </div>
                        )
                    ))}
                    {
                        (speechText === 'Processing...' || speechText === 'Listening....') && (
                            <div className='flex justify-end w-[90%]'>
                                <p className='bg-gray-100 p-3 rounded-lg'>{speechText}<b className='ml-1 text-wrap'> : User</b></p>
                            </div>
                        )
                    }
                    {
                        (errorInRecording) && (
                            <div className='flex justify-end w-[90%]'>
                                <p className='bg-gray-100 p-3 rounded-lg text-red-500'>{speechText}<b className='ml-1 text-wrap text-black'> : User</b></p>
                            </div>
                        )
                    }
                    {isTyping && (
                        <div className='flex justify-start w-[90%] gap-2'>
                            <p className='bg-gray-100 p-3 rounded-lg'><b className='mr-1 text-nowrap'>Bot :</b>{botChat}</p>
                        </div>
                    )}
                </div>
            </div>
            <div className='h-[10vh] w-[90vw] flex justify-center items-center gap-8 mb-6'>
                {
                    recording ? (
                        <div className='flex flex-col justify-center items-center gap-2'>
                            <div className='text-black text-center font-medium text-1xl'>
                                Recording Time: {Math.floor(recordingTime / 60)}:{recordingTime % 60 < 10 ? '0' : ''}{recordingTime % 60}
                            </div>
                            <button className='h-8 w-12 p-1 flex justify-center items-center rounded-md text-black/100 hover:bg-black hover:text-white text-lg' onClick={stopRecording}>
                                stop
                            </button>
                        </div>
                    ) : (
                        <button className={`bg-slate-400 rounded-full p-2 ${isTyping || speechText === 'Processing...' ? 'cursor-not-allowed' : 'cursor-pointer' }`} onClick={startRecording} disabled={isTyping || speechText === 'Processing...'}>
                            <TiMicrophone className={'text-3xl'} />
                        </button>
                    )
                }
                <button onClick={toggleListenToSpeech }>
                    {
                        listenToSpeech ? (
                            <img src={sound} alt='sound-icon' className='h-6 w-6'/>
                        ) : (
                            <img src={noSound} alt='sound-icon' className='h-6 w-6'/>
                        )
                    }
                </button>
            </div>
            <Link to='/chat' className='text-lg font-semibold absolute right-[5%] md:bottom-[5%] bottom-[18%] bg-slate-400 rounded-full p-3'>
                <IoChatbubbleEllipses/>
            </Link>
        </div>
    )
}

export default Voice
