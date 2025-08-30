const express = require('express');
const router = express.Router();
router.get('/status', (req, res) => res.status(200).json({ status: 'API is running' }));
module.exports = router;
