import './App.css'
import Cctv from './component/Cctv'
// import Logistics from './component/Logistics'
// import safelogixLogo from './assets/SafeLogiXlogo.png'
// import secure from './assets/Secure.png'
// import document from './assets/Document.png'

function App() {
  return (
    <div className="app">
      {/* <img 
        src={safelogixLogo} 
        alt="SafeLogiX Logo" 
        className="img-logo" 
      />
      <div className="icon-box secure-pos">
        <img src={secure} alt="Secure" className="img-secure" />
        <p className="icon-text">감시</p>
      </div>

      <div className="icon-box document-pos">
        <img src={document} alt="Document" className="img-document" />
        <p className="icon-text">문서</p>
      </div> */}

      <Cctv />
      {/* <Logistics /> */}

    </div>
  )
}

export default App