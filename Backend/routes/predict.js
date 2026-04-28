const express = require("express");
const router = express.Router();
const {
	predict,
	explainPrediction,
	getHistory,
	deletePrediction,
	submitFeedback,
	retrainFromFeedback,
	getRetrainStats,
} = require("../controllers/predictController");

router.post("/", predict);
router.post("/explain", explainPrediction);
router.get("/history/:userId", getHistory);
router.get("/retrain/stats", getRetrainStats);
router.post("/retrain", retrainFromFeedback);
router.patch("/:id/feedback", submitFeedback);
router.delete("/:id", deletePrediction);

module.exports = router;
