import { useForm } from "react-hook-form";
import type { SubmitHandler } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import Cookies from "universal-cookie";
import type { User as StreamUser } from "@stream-io/video-react-sdk";
import { StreamVideoClient } from "@stream-io/video-react-sdk";
import { useNavigate } from "react-router-dom";
import { useUser } from "../../user-context";
import { useState } from "react";

// Define input types
interface FormValues {
  username: string;
  name: string;
}

export const SignIn = () => {
  const cookies = new Cookies();
  const navigate = useNavigate();
  const { setClient, setUser } = useUser();
  const [loading, setLoading] = useState(false);

  // Validation schema
  const schema = yup.object().shape({
    username: yup
      .string()
      .required("Username is required")
      .matches(
        /^[a-zA-Z0-9_@&]{3,20}$/,
        "Username must be 3–20 chars (letters, numbers, _, @, &) only"
      ),
    name: yup
      .string()
      .required("Name is required")
      .matches(/^[A-Za-z\s]{3,30}$/, "Name must be 3–30 letters only"),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: yupResolver(schema),
  });

  // Handle form submission
  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    const { username, name } = data;
    setLoading(true);

    try {
      const response = await fetch("http://localhost:5000/auth/createUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          name,
          image: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        console.error("Failed to create user:", response.status, body);
        alert("Failed to create user. Please try again.");
        setLoading(false);
        return;
      }

      const responseData = await response.json();

      if (!responseData?.token) {
        console.error("No token returned from server:", responseData);
        alert("Server did not return a token. Contact admin.");
        setLoading(false);
        return;
      }

      const user: StreamUser = {
        id: username,
        name,
        image: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`,
      };

      // Create the StreamVideo client and store it in context so other pages can use it
      const myClient = new StreamVideoClient({
        apiKey: "rgsrdsbqkcm5", // consider moving to env
        user,
        token: responseData.token,
      });

  // Save client in context
  setClient(myClient);
  // Also set the user in our app context so pages can access username/name
  setUser({ username, name });

      // Persist cookies
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 1); // 1-day expiry

      cookies.set("token", responseData.token, { expires: expiry });
      cookies.set("username", responseData.username ?? username, { expires: expiry });
      cookies.set("name", responseData.name ?? name, { expires: expiry });

      // Navigate to main page where MainPage will find client in context
      navigate("/");

      setLoading(false);
    } catch (error) {
      console.error("Sign-in error:", error);
      alert("An error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="SignIn">
      <h1>Welcome to Ake'sTech Audio Chats</h1>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div>
          <input type="text" placeholder="Username" {...register("username")} />
          {errors.username && (
            <p style={{ color: "red" }}>{errors.username.message}</p>
          )}
        </div>

        <div>
          <input type="text" placeholder="Name" {...register("name")} />
          {errors.name && (
            <p style={{ color: "red" }}>{errors.name.message}</p>
          )}
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
};