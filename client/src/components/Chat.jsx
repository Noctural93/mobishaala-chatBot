import React, { useEffect, useRef, useState } from 'react'
import SpeechToText from './SpeechToText'
import io from 'socket.io-client'
import { Link } from 'react-router-dom'

const Chat = () => {

    const [botChat, setBotChat] = useState('')
    const [speechText, setSpeechText] = useState('')
    const [socket, setSocket] = useState(null)
    const [isTyping, setIsTyping] = useState(false)
    const [chatHistory, setChatHistory] = useState([])
    const chatContainerRef = useRef(null)
    const [isUserScrolled, setIsUserScrolled] = useState(false)

    const handleTranscript = (text) => {
        setSpeechText(text.toLowerCase())
    }

    useEffect(() => {
        const newSocket = io('https://mobishaala-chatbot.onrender.com')
        setSocket(newSocket)

        newSocket.on('chatReceiveMessage', (data) => {
            if(data.response) {
                handleTypingEffect(data.response)
            }
        })

        newSocket.on('chatError', (error) => {
            console.log('Error : ', error)
        })

        return () => {
            newSocket.close();
        }
    }, [])

    const handlesubmitForm = async(e) => {
        e.preventDefault()
        if(isTyping) return;
        setIsTyping(false);
        setChatHistory(prev => [...prev, { "type" : 'user', "chat": speechText }])
        if(socket) {
            socket.emit('chatSendMessage', { msg: speechText })
            setSpeechText('')
        }
        // try{
        //     const response = await fetch('http://localhost:5000/chat', {
        //         method: 'POST',
        //         headers: {
        //             'Content-Type': 'Application/json',
        //         },
        //         body: JSON.stringify({msg: speechText})
        //     });

        //     if(response.ok){
        //         const data = await response.json()
        //         setBotChat(data.response);
        //     }
        // } catch(err) {
        //     console.log('Error: ', err)
        // }
    }

    const handleTypingEffect = (text) => {
        setBotChat('')
        setIsTyping(true)

        let index = 0;

        const intervalId = setInterval(() => {
            setBotChat((prev) => prev + text[index-1]);
            index++;

            if(index === text.length - 1) {
                clearInterval(intervalId);
                setIsTyping(false)
                setChatHistory(prev => [...prev, { "role": "bot", "chat" : text }])
            }
        }, 50)
    }

    useEffect(()=>{
        if(!isUserScrolled){
            chatContainerRef.current.scrollTo(0, chatContainerRef.current.scrollHeight);
        }
    }, [chatHistory, isTyping, isUserScrolled, botChat])

    const scrollHandler = () => {
        const { scrollTop, clientHeight, scrollHeight } = chatContainerRef.current;
        // console.log(scrollHeight - scrollTop > clientHeight + 10)
        if (scrollHeight - scrollTop > clientHeight + 10) { 
            setIsUserScrolled(true);
        } else {
            setIsUserScrolled(false);
        }
    }

  return (
    <div className='flex flex-col items-center justify-center h-[100vh] w-[100vw] gap-1 relative'>
      <div ref={chatContainerRef} className='w-[100%] h-[80vh] overflow-auto flex items-center justify-center' onScroll={scrollHandler}>
        <div className='flex flex-col items-center w-[70%] h-[80vh] justify-start gap-8'>
          {
              chatHistory.map((item, index)=> (
                  (item.type === 'user') ? (
                      <div key={index} className='flex justify-end w-[90%]'>
                          <p className='bg-gray-100 p-3 rounded-lg'>{item.chat}<b className='ml-1 text-wrap'> : User</b></p>
                      </div>
                  ) : (
                      (
                          <div key={index} className='flex justify-start w-[90%]'>
                              <p className='bg-gray-100 p-3 rounded-lg'><b className='mr-1 text-nowrap'>Bot :</b>{item.chat}</p>
                          </div>
                      )
                  )
              ))
          }
          {
              (isTyping) && (
                  <div className='flex justify-start w-[90%]'>
                      <p className='bg-gray-100 p-3 rounded-lg'><b className='mr-1 text-nowrap'>Bot :</b>{botChat}</p>
                  </div>
              )
          }
        </div>
      </div>
      <div className='w-[90vw] h-[10vh] flex justify-center items-center gap-2'>
        <SpeechToText onTranscript={handleTranscript} className='w-[20%]'/>
        <div className='flex w-[50%] h-[100%]'>
            <form onSubmit={handlesubmitForm} className='flex gap-2 justify-center items-center h-[100%] w-[100%]'>
                <input type='text' placeholder='You can ask me anything' value={speechText} onChange={(e) => setSpeechText(e.target.value)} className='border-gray-400 border-2 h-[45%] w-[90%] px-2'/>
                <button type='submit' className={`h-[45%] w-[10%] bg-slate-400 font-sans text-lg font-semibold ${isTyping ? 'cursor-not-allowed':'cursor-pointer'}`} disabled={isTyping}>send</button>
            </form>
        </div>
      </div>
      <Link to='/voice' className='text-lg font-semibold absolute right-[5%] bottom-[5%] bg-slate-400 rounded-full px-2 py-8'>
            voice Bot
      </Link>
    </div>
  )
}

export default Chat
