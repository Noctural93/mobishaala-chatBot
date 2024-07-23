import React, { useEffect, useState } from 'react'
import SpeechToText from './SpeechToText'
import io from 'socket.io-client'

const Chat = () => {

    const [userChat, setUserChat] = useState('')
    const [botChat, setBotChat] = useState('')
    const [speechText, setSpeechText] = useState('')
    const [socket, setSocket] = useState(null)
    const [isTyping, setIsTyping] = useState(false)

    const handleTranscript = (text) => {
        setSpeechText(text.toLowerCase())
    }

    useEffect(() => {
        const newSocket = io('http://localhost:5000')
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
        setIsTyping(false);
        setUserChat(speechText)
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
            }
        }, 50)
    }

  return (
    <div className='flex flex-col items-center h-[100vh] w-[100vw] gap-1'>
      <div className='flex flex-col items-center w-[80vw] h-[90vh] justify-end'>
      <p className='flex justify-end w-[90%]'>{userChat}<b> : User</b></p>
        { botChat !== '' && (
            (isTyping) ? (
                <p className='flex justify-start w-[90%]'><b>Bot:</b>{botChat}</p>
            ) : (
                <p className='flex justify-start w-[90%]'><b>Bot:</b> Typing...</p>
            )
        )}
      </div>
      <div className='w-[90vw] h-[10vh] flex justify-center items-center gap-2'>
        <SpeechToText onTranscript={handleTranscript} className='w-[20%]'/>
        <div className='flex w-[50%] h-[100%]'>
            <form onSubmit={handlesubmitForm} className='flex gap-2 justify-center items-center h-[100%] w-[100%]'>
                <input type='text' placeholder='You can ask me anything' value={speechText} onChange={(e) => setSpeechText(e.target.value)} className='border-gray-400 border-2 h-[45%] w-[90%] px-2'/>
                <button type='submit' className='h-[45%] w-[10%] bg-slate-400 font-sans text-lg font-semibold'>send</button>
            </form>
        </div>
      </div>
    </div>
  )
}

export default Chat
