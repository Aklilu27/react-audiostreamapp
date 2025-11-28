"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const stream_client_1 = require("../stream-client");
const router = (0, express_1.Router)();
router.post("/createUser", async (req, res) => {
    const { username, name, image } = req.body;
    if (!username || !name || !image) {
        return res
            .status(400)
            .json({ message: "All fields are required" });
    }
    const newUser = {
        id: username,
        role: "user",
        name,
        image,
    };
    // upsertUsers expects an array of UserRequest
    const user = await stream_client_1.Client.upsertUsers([newUser]);
    const expiry = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24 hours
    const token = stream_client_1.Client.createToken(username, expiry);
    return res.status(201).json({ token, username, name });
});
exports.default = router;
//# sourceMappingURL=auth.js.map