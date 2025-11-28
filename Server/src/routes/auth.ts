import { Router, Request, Response } from "express";
import { Client } from "../stream-client";
import type { UserRequest } from "@stream-io/node-sdk";

const router = Router();

router.post("/createUser", async (req: Request, res: Response) => {
  const { username, name, image } = req.body;

  if (!username || !name || !image) {
    return res
      .status(400)
      .json({ message: "All fields are required" });
  }

  const newUser: UserRequest = {
    id: username,
    role: "user",
    name,
    image,
  };

  try {
    // upsertUsers expects an array of UserRequest
    const user = await Client.upsertUsers([newUser]);

    const expiry = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24 hours
    const token = Client.createToken(username, expiry);
    return res.status(201).json({ token, username, name, user });
  } catch (err: any) {
    console.error("/auth/createUser error:", err);
    return res.status(500).json({ message: "Server error", detail: err?.message ?? String(err) });
  }
});

export default router;