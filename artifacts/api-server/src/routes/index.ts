import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import projectsRouter from "./projects";
import generateRouter from "./generate";
import templatesRouter from "./templates";
import creditsRouter from "./credits";
import dashboardRouter from "./dashboard";
import publicRouter from "./public";
import integrationsRouter from "./integrations";
import communityRouter from "./community";
import { seedTemplates } from "./templates";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(projectsRouter);
router.use(generateRouter);
router.use(templatesRouter);
router.use(creditsRouter);
router.use(dashboardRouter);
router.use(publicRouter);
router.use(integrationsRouter);
router.use(communityRouter);

// Seed templates on startup
seedTemplates().catch((err) => console.error("Failed to seed templates:", err));

export default router;
