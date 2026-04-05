import { useState } from 'react'
import './App.css'
import Cctv from './component/Cctv'
import Logistics from './component/Logistics'
import safelogixLogo from './assets/SafeLogiXlogo.png'
import secure from './assets/Secure.png'
import document from './assets/Document.png'

type View = 'home' | 'cctv' | 'logistics'

function App() {
  const [view, setView] = useState<View>('home')

  return (
    <div className="app">
        {view === 'home' && (
          <>
            <img
              src={safelogixLogo}
              alt="SafeLogiX Logo"
              className="img-logo"
            />

            <div className="icon-box secure-pos" onClick={() => setView('cctv')}>
              <img src={secure} alt="Secure" className="img-secure" />
              <p className="icon-text">감시</p>
            </div>

            <div className="icon-box document-pos" onClick={() => setView('logistics')}>
              <img src={document} alt="Document" className="img-document" />
              <p className="icon-text">문서</p>
            </div>
          </>
        )}

        {view === 'cctv' && <Cctv onNavigate={setView} />}
        {view === 'logistics' && <Logistics onNavigate={setView} />}
    </div>
  )
}

export default App