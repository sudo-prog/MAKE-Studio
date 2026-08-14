# MakerForge (MAKE-Studio)

MakerForge is an AI-powered project generation platform designed for makers. It streamlines the process of bringing ideas to life by automating project scaffolding, generating Bills of Materials (BOM), and providing a community-driven ecosystem for showcasing and remixing hardware and software projects.

## 🚀 Key Features

- **AI Project Generation**: Transform prompts into detailed project plans, components lists, and build guides.
- **Credit-Based System**: Managed access to AI generation features.
- **Community Showcase**: Publish your creations, participate in challenges, and explore others' work.
- **Remix & Fork**: Build upon existing community projects to accelerate innovation.
- **Integrated Payments**: Seamless checkout and subscription management via Stripe.
- **Social Authentication**: Quick onboarding with GitHub OAuth.
- **Cross-Platform Access**: Web frontend built with React/Vite and a mobile app scaffolded with Expo.

## 🛠 Tech Stack

- **Frontend**: React, Vite, TypeScript
- **Mobile**: Expo (React Native)
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL, Drizzle ORM
- **Authentication**: GitHub OAuth
- **Payments**: Stripe
- **Monorepo Management**: pnpm

## 🏁 Getting Started

### Prerequisites

- Node.js 22.x
- pnpm
- PostgreSQL

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/sudo-prog/MAKE-Studio.git
   cd MAKE-Studio
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Environment Setup:
   Create a `.env` file in the root (or respective package directories) with the following variables:
   - `DATABASE_URL`
   - `STRIPE_SECRET_KEY`
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`

4. Database Migration:
   ```bash
   pnpm run db:push
   ```

5. Start Development Servers:
   ```bash
   pnpm run dev
   ```

## 📖 Usage

- **Generate**: Use the AI prompt interface to create a new project skeleton.
- **Manage**: Edit your BOM and build guides within the project editor.
- **Share**: Publish your completed project to the community showcase.

## 📄 License

This project is licensed under the MIT License.

## 🔗 Links

- Repository: [https://github.com/sudo-prog/MAKE-Studio](https://github.com/sudo-prog/MAKE-Studio)
