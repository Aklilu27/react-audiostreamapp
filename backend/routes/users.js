const express = require('express');
const User = require('../models/User');
const router = express.Router();

const buildProfile = (user) => ({
	_id: user._id,
	username: user.username,
	email: user.email,
	avatar: user.avatar,
	bio: user.bio,
	role: user.role,
	createdAt: user.createdAt,
	roomsJoined: user.stats?.roomsJoined || 0,
	messagesSent: user.stats?.totalMessages || 0,
	lastActive: user.lastSeen
});

router.get('/profile', async (req, res, next) => {
	try {
		const user = await User.findById(req.user._id).select('-password');
		if (!user) {
			return res.status(404).json({ success: false, message: 'User not found' });
		}

		res.json({ success: true, user: buildProfile(user) });
	} catch (error) {
		next(error);
	}
});

router.put('/profile', async (req, res, next) => {
	try {
		const { username, email, bio, avatar } = req.body || {};
		const user = await User.findById(req.user._id).select('-password');
		if (!user) {
			return res.status(404).json({ success: false, message: 'User not found' });
		}

		if (username) user.username = username.trim();
		if (email) user.email = email.trim().toLowerCase();
		if (bio !== undefined) user.bio = bio;
		if (avatar !== undefined) user.avatar = avatar;

		await user.save();

		res.json({ success: true, user: buildProfile(user) });
	} catch (error) {
		next(error);
	}
});

router.put('/change-password', async (req, res, next) => {
	try {
		const { currentPassword, newPassword } = req.body || {};

		if (!currentPassword || !newPassword) {
			return res.status(400).json({
				success: false,
				message: 'Current and new passwords are required'
			});
		}

		const user = await User.findById(req.user._id).select('+password');
		if (!user) {
			return res.status(404).json({ success: false, message: 'User not found' });
		}

		const isMatch = await user.comparePassword(currentPassword);
		if (!isMatch) {
			return res.status(401).json({ success: false, message: 'Current password is incorrect' });
		}

		user.password = newPassword;
		await user.save();

		res.json({ success: true, message: 'Password updated' });
	} catch (error) {
		next(error);
	}
});

module.exports = router;
