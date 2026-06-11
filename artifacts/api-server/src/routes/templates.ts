import { Router } from "express";
import { db } from "@workspace/db";
import { templatesTable, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireDbUser } from "../lib/auth";

const router = Router();

// GET /api/templates
router.get("/templates", async (req, res) => {
  try {
    const category = req.query.category ? String(req.query.category) : undefined;
    let rows;
    if (category) {
      rows = await db.select().from(templatesTable).where(eq(templatesTable.category, category));
    } else {
      rows = await db.select().from(templatesTable).where(eq(templatesTable.isActive, true));
    }
    res.json(rows.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      category: t.category,
      difficulty: t.difficulty,
      imageUrl: t.imageUrl,
      promptSeed: t.promptSeed,
      tags: t.tags ?? [],
    })));
  } catch (err) {
    res.status(500).json({ error: "Failed to list templates" });
  }
});

// POST /api/templates/:id/fork
router.post("/templates/:id/fork", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const id = parseInt(req.params.id);
    const [template] = await db.select().from(templatesTable).where(eq(templatesTable.id, id)).limit(1);
    if (!template) return res.status(404).json({ error: "Template not found" });

    const [project] = await db.insert(projectsTable).values({
      userId: user.id,
      title: `${template.title} (fork)`,
      prompt: template.promptSeed,
      category: template.category,
      status: "draft",
      templateId: template.id,
    }).returning();

    res.status(201).json({
      id: project.id,
      title: project.title,
      prompt: project.prompt,
      description: null,
      status: project.status,
      isPublic: false,
      shareSlug: null,
      renderImageUrl: null,
      category: project.category,
      skillLevel: null,
      estimatedCost: null,
      estimatedTime: null,
      sections: {},
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fork template" });
  }
});

export async function seedTemplates() {
  const existing = await db.select({ id: templatesTable.id }).from(templatesTable).limit(1);
  if (existing.length > 0) return;

  await db.insert(templatesTable).values([
    {
      title: "Portable Solar Charger",
      description: "Build a rugged 10,000mAh USB-C PD solar charger with LED indicators for outdoor adventures.",
      category: "Energy",
      difficulty: "intermediate",
      imageUrl: null,
      promptSeed: "Portable solar charger with 10,000mAh lithium battery, USB-C Power Delivery, 20W solar panel input, LED battery indicator, rugged weatherproof enclosure for hiking. Include MPPT charge controller.",
      tags: ["solar", "charging", "outdoor", "electronics"],
    },
    {
      title: "Smart Plant Monitor",
      description: "ESP32-powered plant monitor with soil moisture, temperature, humidity sensors and WiFi alerts.",
      category: "IoT",
      difficulty: "beginner",
      imageUrl: null,
      promptSeed: "Smart plant monitoring system using ESP32 with soil moisture sensor, DHT22 temperature and humidity sensor, small OLED display, WiFi connectivity for mobile alerts, 3D printed enclosure with cable management for standard plant pot.",
      tags: ["iot", "plants", "esp32", "sensors"],
    },
    {
      title: "Robotic Gripper",
      description: "3-finger servo-actuated robotic gripper with force feedback, compatible with standard robot arms.",
      category: "Robotics",
      difficulty: "advanced",
      imageUrl: null,
      promptSeed: "3-finger servo robotic gripper for robot arm attachment. Uses 3x MG996R servos, force sensing resistors for grip feedback, Arduino Nano controller, fully 3D printable PLA structure, standard bolt-circle mounting pattern 50mm diameter.",
      tags: ["robotics", "servo", "gripper", "arduino"],
    },
    {
      title: "LED Desk Lamp",
      description: "Minimalist articulating LED desk lamp with touch dimmer, USB charging port, and Qi wireless charging base.",
      category: "Lighting",
      difficulty: "beginner",
      imageUrl: null,
      promptSeed: "Modern minimalist LED desk lamp with articulating arm, touch-sensitive dimmer control, 3000K-6500K color temperature adjustment, USB-A and USB-C charging ports in base, Qi wireless charging pad integrated in base, 3D printable PLA structure.",
      tags: ["lighting", "led", "desk", "usb"],
    },
    {
      title: "Accessibility Button Controller",
      description: "Large-button accessibility controller for computer access, customizable for users with limited mobility.",
      category: "Accessibility",
      difficulty: "beginner",
      imageUrl: null,
      promptSeed: "Accessibility switch controller for computer input with 4 large tactile buttons (60mm diameter), USB HID connection, configurable key mapping via USB, high-contrast colors, Pro Micro microcontroller, durable ABS-equivalent 3D print with non-slip base.",
      tags: ["accessibility", "hid", "arduino", "assistive"],
    },
    {
      title: "Mini CNC Pen Plotter",
      description: "Desktop XY pen plotter using stepper motors and GRBL, perfect for learning CNC concepts.",
      category: "CNC",
      difficulty: "advanced",
      imageUrl: null,
      promptSeed: "Mini desktop pen plotter CNC machine with 200x200mm work area. Uses NEMA17 stepper motors, Arduino Uno with GRBL shield, linear rails for X and Y axes, servo-lifted pen holder, GRBL compatible firmware, 3D printed frame and carriage system.",
      tags: ["cnc", "plotter", "grbl", "stepper"],
    },
  ]);
}

export default router;
