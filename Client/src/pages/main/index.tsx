import { StreamCall, StreamVideo } from "@stream-io/video-react-sdk";
import { useUser } from "../../user-context";
import { Navigate, useNavigate } from "react-router-dom";
import { useState } from "react";
import CryptoJS from "crypto-js";

interface NewRoom {
  name: string;
  description: string;
}

export const MainPage = () => {
  const { client, user ,setCall,isLoadingClient} = useUser(); // ✅ include user
  const [newRoom, setNewRoom] = useState<NewRoom>({ name: "", description: "" });

  const navigate = useNavigate();
  const hashRoomName = (roomName:string):string=>{
  const hash = CryptoJS.SHA256(roomName).toString(CryptoJS.enc.Base64);
  return hash.replace(/[^a-zA-Z0-9_-]/g,"");
  };


  const CreateRoom = async () => {
    const { name, description } = newRoom;

    // ✅ Validate inputs
    if (!client || !user || !name || !description) return ;

   
      // Create an audio room call
      const call = client.call("audio_room", hashRoomName(name));

      await call.join({
        create: true,
        data: {
          members: [{ user_id: user.username }],
          custom: {
            title: name,
            description,
          },
        },
      });

      StreamCall(call);
       navigate ("/room")
    }
    if(isLoadingClient) return <h1>....</h1>

  // ✅ Redirect if not logged in
  if(!client) return <Navigate to="/sign-in" />;

  if((!isLoadingClient && !user || !isLoadingClient && !client))
    return <Navigate to="/sign-in"/>;
   
  return (
    <StreamVideo client={client!}>
      <div className="home">
        <h1>Welcome, {user?.name}</h1>

        <div className="form">
          <h2>Create Your Own Room</h2>

          <input
            type="text"
            placeholder="Room Name..."
            value={newRoom.name}
            onChange={(e) => setNewRoom((prev) => ({ ...prev, name: e.target.value }))}
          />

          <input
            type="text"
            placeholder="Room Description..."
            value={newRoom.description}
            onChange={(e) => setNewRoom((prev) => ({ ...prev, description: e.target.value }))}
          />

          <button onClick={CreateRoom} style={{ backgroundColor: "rgb(125,7,236)", color: "#fff" }}>
            Create Room
          </button>
        </div>
      </div>
    </StreamVideo>
  );
};
