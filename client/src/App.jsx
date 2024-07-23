import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { lazy } from 'react'

const Chat = lazy(() => import('./components/Chat'))
const Voice = lazy(() => import('./components/Voice'))
const App = () => {
  return(
    <BrowserRouter>
      <Routes>
        <Route path='/chat' element={<Chat/>}/>
        <Route path='/' element={<Navigate to='/chat'/>}/>
        <Route path='/voice' element={<Voice/>}/>
      </Routes>
    </BrowserRouter>
  )
}

export default App
