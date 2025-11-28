import { useCallStateHooks } from "@stream-io/video-react-sdk"

export const Room = ()=>{
  const {useCallCustomData ,useParticipants,useCallCreatedBy}=useCallStateHooks() ;

  const custom = useCallCustomData();
  const participants = useParticipants();
  const createdBy = useCallCreatedBy();
return(
  <div className="room">
    <h2 className="title">{custom?.title ?? "TITLE"}</h2>
     <h2 className="discription">{custom?.description ?? "DESCRIPTION"}</h2>
     <p className="participants-count">{participants.length} participants</p>

  </div>
)
}