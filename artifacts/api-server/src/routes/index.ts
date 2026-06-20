import { Router, type IRouter } from "express";
import healthRouter from "./health";
import puzzleRouter from "./puzzle";
import playersRouter from "./players";
import statsRouter from "./stats";
import ugcRouter from "./ugc";
import partnerRouter from "./partner";
import leaderboardRouter from "./leaderboard";
import feedbackRouter from "./feedback";
import devRouter from "./dev";
import questsRouter from "./quests";
import duelsRouter from "./duels";

const router: IRouter = Router();

router.use(healthRouter);
router.use(puzzleRouter);
router.use(playersRouter);
router.use(statsRouter);
router.use(ugcRouter);
router.use(partnerRouter);
router.use(leaderboardRouter);
router.use(feedbackRouter);
router.use(devRouter);
router.use(questsRouter);
router.use(duelsRouter);

export default router;
