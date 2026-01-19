const express = require('express');
const bcrypt = require('bcryptjs');
const Room = require('../models/Room');
const { grantAccess, clearRoomAccess } = require('../utils/roomAccess');
const router = express.Router();

const mapRoom = (room) => {
	const speakerCount = room.speakers?.length || 0;
	const listenerCount = room.listeners?.length || 0;
	const hostCount = room.host ? 1 : 0;

	return {
		id: room._id,
		name: room.title,
		description: room.description || '',
		category: room.category || 'Other',
		isPrivate: room.isPrivate || false,
		thumbnail: room.thumbnail,
		hostId: room.host ? room.host.toString() : null,
		hostUsername: room.hostUsername,
		participantCount: speakerCount + listenerCount + hostCount,
		createdAt: room.createdAt
	};
};

const mapRoomDetail = (room) => ({
	...mapRoom(room),
	speakers: (room.speakers || []).map((speaker) => ({
		userId: speaker.user,
		username: speaker.username,
		joinedAt: speaker.joinedAt,
		isSpeaking: speaker.isSpeaking,
		isMuted: speaker.isMuted
	})),
	listeners: (room.listeners || []).map((listener) => ({
		userId: listener.user,
		username: listener.username,
		joinedAt: listener.joinedAt
	})),
	raisedHands: (room.raisedHands || []).map((hand) => ({
		userId: hand.user,
		username: hand.username,
		raisedAt: hand.raisedAt,
		status: hand.status
	}))
});

router.get('/', async (req, res, next) => {
	try {
		const rooms = await Room.find({ isActive: true })
			.sort({ createdAt: -1 })
			.limit(50)
			.lean();

		res.json({
			success: true,
			rooms: rooms.map(mapRoom)
		});
	} catch (error) {
		next(error);
	}
});

router.get('/:id', async (req, res, next) => {
	try {
		const room = await Room.findOne({ _id: req.params.id, isActive: true }).lean();
		if (!room) {
			return res.status(404).json({ success: false, message: 'Room not found' });
		}

		res.json({
			success: true,
			room: mapRoomDetail(room)
		});
	} catch (error) {
		next(error);
	}
});

router.post('/', async (req, res, next) => {
	try {
		const {
			title,
			description = '',
			category = 'Other',
			isPrivate = false,
			password
		} = req.body || {};

		if (!title || title.trim().length < 3) {
			return res.status(400).json({
				success: false,
				message: 'Room title must be at least 3 characters'
			});
		}

		if (isPrivate && (!password || password.length < 4)) {
			return res.status(400).json({
				success: false,
				message: 'Private rooms require a password with at least 4 characters'
			});
		}

		const passwordHash = isPrivate ? await bcrypt.hash(password, 10) : undefined;

		const room = await Room.create({
			title: title.trim(),
			description: description.trim(),
			category,
			isPrivate: Boolean(isPrivate),
			password: passwordHash,
			host: req.user._id,
			hostUsername: req.user.username,
			speakers: [{ user: req.user._id, username: req.user.username, joinedAt: new Date() }],
			listeners: []
		});

		res.status(201).json({
			success: true,
			room: mapRoom(room)
		});

		grantAccess(room._id.toString(), req.user._id.toString());
	} catch (error) {
		next(error);
	}
});

router.post('/:id/join', async (req, res, next) => {
	try {
		const { password } = req.body || {};
		const room = await Room.findOne({ _id: req.params.id, isActive: true }).select('+password');

		if (!room) {
			return res.status(404).json({ success: false, message: 'Room not found' });
		}

		if (!room.isPrivate) {
			return res.json({ success: true, room: mapRoom(room) });
		}

		if (!password) {
			return res.status(401).json({ success: false, message: 'Password is required' });
		}

		const isMatch = await bcrypt.compare(password, room.password || '');
		if (!isMatch) {
			return res.status(401).json({ success: false, message: 'Invalid room password' });
		}

		grantAccess(room._id.toString(), req.user._id.toString());

		res.json({ success: true, room: mapRoom(room) });
	} catch (error) {
		next(error);
	}
});

router.delete('/:id', async (req, res, next) => {
	try {
		const room = await Room.findById(req.params.id);
		if (!room || !room.isActive) {
			return res.status(404).json({ success: false, message: 'Room not found' });
		}

		const isHost = room.host?.toString() === req.user._id.toString();
		const isAdmin = req.user.role === 'admin';

		if (!isHost && !isAdmin) {
			return res.status(403).json({ success: false, message: 'Not authorized to delete this room' });
		}

		room.isActive = false;
		await room.save();

		clearRoomAccess(room._id.toString());

		res.json({ success: true, message: 'Room deleted' });
	} catch (error) {
		next(error);
	}
});

module.exports = router;
