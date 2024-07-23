import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { lazy, Suspense } from 'react'

const Chat = lazy(() => import('./components/Chat'))
const Voice = lazy(() => import('./components/Voice'))
const App = () => {
  return(
    <BrowserRouter>
      <Suspense>
        <Routes>
          <Route path='/chat' element={<Chat/>}/>
          <Route path='/' element={<Navigate to='/chat'/>}/>
          <Route path='/voice' element={<Voice/>}/>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
