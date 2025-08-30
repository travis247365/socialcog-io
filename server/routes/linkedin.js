const express = require('express');
const router = express.Router();
router.post('/profile', (req, res) => res.json({ message: 'LinkedIn profile endpoint placeholder' }));
module.exports = router;
