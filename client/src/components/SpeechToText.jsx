import { useEffect, useRef, useState } from 'react'
import { TiMicrophone } from "react-icons/ti";

const SpeechToText = ({onTranscript}) => {
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef(null);

    useEffect(() => {
        // Initialize the SpeechRecognition object
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;

        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript += transcript;
                }
            }
            finalTranscript = finalTranscript + interimTranscript
            onTranscript(finalTranscript.trim().replace(/\.+$/, ''))
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
        };

        return () => {
            recognition.stop();
        };
    }, []);

    const handleMicClick = () => {
        if (isListening) {
            recognitionRef.current.stop();
        } else {
            recognitionRef.current.start();
        }
        setIsListening(!isListening);
    };

    return (
        <div>
            <button onMouseDown={handleMicClick} onMouseUp={handleMicClick} className={isListening ? 'bg-slate-200 rounded-full p-2' : 'bg-slate-400 rounded-full p-2'}>
                <TiMicrophone className='text-xl'/>
            </button>
        </div>
    );
}

export default SpeechToText
