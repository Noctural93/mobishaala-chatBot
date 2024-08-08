import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import { Link } from 'react-router-dom';
import { TiMicrophone } from "react-icons/ti";

const Chat = () => {
  const [botChat, setBotChat] = useState('typing.....');
  const [speechText, setSpeechText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const chatContainerRef = useRef(null);
  const [isUserScrolled, setIsUserScrolled] = useState(false);
  const [recording, setRecording] = useState(false);
  const [isMicPopupOpen, setIsMicPopupOpen] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [errorInRecording, setErrorInRecording] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const newSocket = useRef(null);
  const timerRef = useRef(null);

  const handleMicPopOpen = () => {
    if(speechText !== 'Processing...'){
        setIsMicPopupOpen(!isMicPopupOpen);
    }

    if(speechText === 'Listening....') {
        setSpeechText('');
    }
    setRecording(false);
    setRecordingTime(0);
    clearInterval(timerRef.current);
  };

  const startRecording = async () => {
    setErrorInRecording(false)
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
          newSocket.current.emit('speechToTextMsgSend', { voiceRecord: reader.result });
        };
        audioChunksRef.current = [];
      };
      mediaRecorderRef.current.start();
      setRecording(true);
      console.log("Recording started...");
      timerRef.current = setInterval(() => {
        setRecordingTime(prevTime => prevTime + 1);
      }, 1000);
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      clearInterval(timerRef.current);
      setRecordingTime(0);
      console.log("Recording stopped....");
      setSpeechText('Processing...')
      setIsMicPopupOpen(!isMicPopupOpen)
    }
  };

  useEffect(() => {
    newSocket.current = io('https://mobishaala-chatbot.onrender.com');

    newSocket.current.on('chatReceiveMessage', (data) => {
      if (data.response) {
        handleTypingEffect(data.response);
      }
    });

    newSocket.current.on('speechToTextMsgReceived', (data) => {
      if (data.response !== undefined) {
        console.log(data.response);
        setSpeechText(data.response)
      } else {
        setErrorInRecording(!errorInRecording)
        setSpeechText("Can't understand plz record once again")
      }
    });

    newSocket.current.on('speechToTextError', (error) => {
      console.log('Error : ', error);
    });

    newSocket.current.on('chatError', (error) => {
      console.log('Error : ', error);
    });

    return () => {
      newSocket.current.close();
    };
  }, []);

  useEffect(() => {
    if(isMicPopupOpen){
        setSpeechText('Listening....')
    }
  }, [isMicPopupOpen])

  const handlesubmitForm = async (e) => {
    e.preventDefault();
    if (isTyping) return;
    setIsTyping(true);
    setChatHistory(prev => [...prev, { "type": 'user', "chat": speechText }]);
    newSocket.current.emit('chatSendMessage', { msg: speechText });
    setSpeechText('');
  };

  const handleTypingEffect = (text) => {
    setBotChat('');
    setIsTyping(true);

    let index = 0;

    const intervalId = setInterval(() => {
      setBotChat((prev) => prev + text[index - 1]);
      index++;

      if (index === text.length - 1) {
        setBotChat('typing...')
        clearInterval(intervalId);
        setIsTyping(false);
        setChatHistory(prev => [...prev, { "role": "bot", "chat": text }]);
      }
    }, 40);
  };

  useEffect(() => {
    if (!isUserScrolled) {
      chatContainerRef.current.scrollTo(0, chatContainerRef.current.scrollHeight);
    }
  }, [chatHistory, isTyping, isUserScrolled, botChat]);

  const scrollHandler = () => {
    const { scrollTop, clientHeight, scrollHeight } = chatContainerRef.current;
    if (scrollHeight - scrollTop > clientHeight + 10) {
      setIsUserScrolled(true);
    } else {
      setIsUserScrolled(false);
    }
  };

  return (
    <div className='flex flex-col items-center justify-center h-[100vh] w-[100vw] gap-1 relative'>
      <div ref={chatContainerRef} className='w-[100%] h-[80vh] overflow-auto flex items-center justify-center' onScroll={scrollHandler}>
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
          {isTyping && (
            <div className='flex justify-start w-[90%]'>
              <p className='bg-gray-100 p-3 rounded-lg'><b className='mr-1 text-nowrap'>Bot :</b>{botChat}</p>
            </div>
          )}
        </div>
      </div>
      <div className='w-[90vw] h-[10vh] flex justify-center items-center gap-2'>
        <button className={`bg-slate-400 rounded-full p-2 ${speechText === 'Processing...' ? 'cursor-not-allowed' : 'cursor-pointer' }`} onClick={handleMicPopOpen}>
          <TiMicrophone className={'text-xl'} />
        </button>
        <div className='flex md:w-[50%] w-[90%] h-[100%]'>
          <form onSubmit={handlesubmitForm} className='flex gap-2 justify-center items-center h-[100%] w-[100%]'>
            <input type='text' placeholder='You can ask me anything' value={speechText} onChange={(e) => setSpeechText(e.target.value)} className={`border-gray-400 border-2 h-[45%] w-[90%] px-2 ${errorInRecording ? 'text-red-500' : ''}`} />
            <button type='submit' className={`h-55px w-55px p-1 bg-slate-400 font-sans text-lg font-semibold ${isTyping ? 'cursor-not-allowed' : 'cursor-pointer'}`} disabled={isTyping || isMicPopupOpen || speechText === 'Processing...'}>send</button>
          </form>
        </div>
      </div>
      <Link to='/voice' className='text-lg font-semibold absolute right-[5%] md:bottom-[5%] bottom-[18%] bg-slate-400 rounded-full p-3'>
        <TiMicrophone className='text-2xl'/>
      </Link>
      {isMicPopupOpen && (
        <div className='absolute bg-opacity-60 bg-gray-500 h-[100%] w-[100%] flex flex-col justify-center items-center'>
          <div className='h-[25%] w-[50%] relative flex flex-col justify-center items-center gap-2 p-5 bg-white rounded-lg md:w-[35%]'>
            <div className='flex flex-col justify-center items-center gap-3'>
            {recording && (
              <div className='text-black text-center font-medium text-1xl'>
                Recording Time: {Math.floor(recordingTime / 60)}:{recordingTime % 60 < 10 ? '0' : ''}{recordingTime % 60}
              </div>
            )}
            <button className='h-8 w-12 p-1 flex justify-center items-center rounded-md text-black/100 hover:bg-black hover:text-white text-lg' onClick={recording ? stopRecording : startRecording}>{recording ? 'stop' : 'start'}</button>
            </div>
            <button className='absolute top-3 right-3 text-lg text-black/100 hover:bg-black hover:text-white rounded-full py-1 px-3' onClick={handleMicPopOpen}>X</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
