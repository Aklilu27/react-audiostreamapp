import { StreamVideoClient, type Call } from "@stream-io/video-react-sdk";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import Cookies from "universal-cookie";

// Define user type
interface User {
  username: string;
  name: string;
}

// Define context type
interface UserContextProps {
  user: User | null;
  setUser: (user: User | null) => void;
  client: StreamVideoClient | undefined;
  setClient: (client: StreamVideoClient | undefined) => void;
  // active call object (any because SDK types vary)
  call: Call | undefined;
  setCall: (call: Call | undefined) => void;
  isLoadingClient:boolean;

}

// Props for provider
interface UserProviderProps {
  children?: ReactNode;
}

// Create context
const UserContext = createContext<UserContextProps | undefined>(undefined);

// Context provider component
export const UserProvider = (props: UserProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
   const [call, setCall] = useState<Call>();
  const [client, setClient] = useState<StreamVideoClient >();
  const [isLoadingClient,setIsLoadingClient] = useState<boolean>(true)
 
  const cookies=new Cookies()
  useEffect(()=>{
    const token = cookies.get("token");
     const username = cookies.get("token");
      const name = cookies.get("token")



      if(!token || !username || !name){
        setIsLoadingClient(false);
       return;
      }

      const user:StreamUserType ={
        id:username,
        name,
      }
      const myClient = new StreamVideoClient({
        apiKey:"rgsrdsbqkcm5",
        user,
        token,
      });
      setClient(myClient);
      setUser({username,name});
      setIsLoadingClient(false);
      return()=>{
        myClient.disconnectUser();
        setClient(undefined);
        setUser(null);
      };
  }, []);
 

  return (
    <UserContext.Provider value={{ user, setUser, client, setClient, call, setCall,isLoadingClient }}>
      {props.children}
    </UserContext.Provider>
  );
};

// Custom hook
export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};