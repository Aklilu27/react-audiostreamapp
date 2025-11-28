import "./App.css";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { MainPage } from "./pages/main/index";
import { SignIn } from "./pages/sign-in";
import { Room } from "./pages/room";
import { UserProvider, useUser } from "./user-context";
import { StreamCall } from "@stream-io/video-react-sdk";

function App() {
  const {call}=useUser();
  return (
    <UserProvider>
      <Router>
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/room" element={
            call ?
            <StreamCall call={call}><Room /> 
            </StreamCall> : <Navigate to="/"/>
          } />
        </Routes>
      </Router>
    </UserProvider>
  );
}

export default App;
