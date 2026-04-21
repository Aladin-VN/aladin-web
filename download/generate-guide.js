const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  PageBreak, Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  SectionType, TableOfContents, LevelFormat,
} = require("docx");
const fs = require("fs");

// ─── Palette: Tech / Minimal ───
const P = {
  primary: "0B1220",
  body: "1E293B",
  secondary: "475569",
  accent: "3B82F6",
  coverBg: "0F172A",
  coverAccent: "3B82F6",
  coverText: "FFFFFF",
  coverMuted: "94A3B8",
  codeBg: "F1F5F9",
  tableHeader: "F8FAFC",
  tableBorder: "CBD5E1",
};

const c = (hex) => hex.replace("#", "");
const allNoBorders = {
  top: { style: BorderStyle.NONE, size: 0 },
  bottom: { style: BorderStyle.NONE, size: 0 },
  left: { style: BorderStyle.NONE, size: 0 },
  right: { style: BorderStyle.NONE, size: 0 },
};

// ─── Helper Functions ───
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 480, after: 200, line: 312 },
    children: [new TextRun({ text, bold: true, size: 32, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "SimHei" } })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 360, after: 160, line: 312 },
    children: [new TextRun({ text, bold: true, size: 28, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "SimHei" } })],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 120, line: 312 },
    children: [new TextRun({ text, bold: true, size: 24, color: c(P.accent), font: { ascii: "Calibri", eastAsia: "SimHei" } })],
  });
}

function body(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: 120, line: 312 },
    ...opts,
    children: [new TextRun({ text, size: 22, color: c(P.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
  });
}

function bodyRuns(runs, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: 120, line: 312 },
    ...opts,
    children: runs,
  });
}

function bold(text) {
  return new TextRun({ text, bold: true, size: 22, color: c(P.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } });
}

function normal(text) {
  return new TextRun({ text, size: 22, color: c(P.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } });
}

function code(text) {
  return new TextRun({ text, size: 20, color: c(P.accent), font: { ascii: "Courier New" } });
}

function codeBlock(lines) {
  return lines.map(line =>
    new Paragraph({
      spacing: { after: 0, line: 260 },
      shading: { type: ShadingType.CLEAR, fill: c(P.codeBg) },
      indent: { left: 360 },
      children: [new TextRun({ text: line, size: 18, font: { ascii: "Courier New" }, color: c(P.body) })],
    })
  );
}

function spacer(pts = 120) {
  return new Paragraph({ spacing: { after: pts }, children: [] });
}

function makeTable(headers, rows) {
  const colWidth = Math.floor(100 / headers.length);
  const borderStyle = {
    top: { style: BorderStyle.SINGLE, size: 1, color: c(P.tableBorder) },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: c(P.tableBorder) },
    left: { style: BorderStyle.NONE },
    right: { style: BorderStyle.NONE },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: c(P.tableBorder) },
    insideVertical: { style: BorderStyle.NONE },
  };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borderStyle,
    rows: [
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: headers.map(text =>
          new TableCell({
            width: { size: colWidth, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: c(P.tableHeader) },
            margins: { top: 60, bottom: 60, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 20, color: c(P.primary), font: { ascii: "Calibri" } })] })],
          })
        ),
      }),
      ...rows.map(row =>
        new TableRow({
          cantSplit: true,
          children: row.map(text =>
            new TableCell({
              width: { size: colWidth, type: WidthType.PERCENTAGE },
              margins: { top: 60, bottom: 60, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text, size: 20, color: c(P.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })] })],
            })
          ),
        })
      ),
    ],
  });
}

// ─── Cover Section ───
function buildCover() {
  return {
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 0, bottom: 0, left: 0, right: 0 },
      },
    },
    children: [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: allNoBorders,
        rows: [
          new TableRow({
            height: { value: 16838, rule: "exact" },
            children: [
              new TableCell({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: allNoBorders,
                shading: { type: ShadingType.CLEAR, fill: c(P.coverBg) },
                verticalAlign: "top",
                margins: { top: 0, bottom: 0, left: 0, right: 0 },
                children: [
                  spacer(4500),
                  new Paragraph({
                    spacing: { after: 200 },
                    indent: { left: 1200 },
                    children: [new TextRun({ text: "DEPLOYMENT GUIDE", bold: true, size: 20, color: c(P.coverAccent), font: { ascii: "Calibri" }, characterSpacing: 200 })],
                  }),
                  new Paragraph({
                    spacing: { after: 200 },
                    indent: { left: 1200 },
                    children: [new TextRun({ text: "ALADIN", bold: true, size: 72, color: c(P.coverText), font: { ascii: "Calibri" } })],
                  }),
                  new Paragraph({
                    spacing: { after: 100 },
                    indent: { left: 1200 },
                    children: [new TextRun({ text: "AI-Powered B2B Commerce Platform", size: 28, color: c(P.coverMuted), font: { ascii: "Calibri" } })],
                  }),
                  spacer(600),
                  new Paragraph({
                    indent: { left: 1200 },
                    children: [new TextRun({ text: "Local Development  |  Neon PostgreSQL  |  Netlify Deployment", size: 20, color: c(P.coverMuted), font: { ascii: "Calibri" } })],
                  }),
                  spacer(2000),
                  new Paragraph({
                    indent: { left: 1200 },
                    children: [new TextRun({ text: "Version 1.0  |  April 2026", size: 18, color: c(P.coverMuted), font: { ascii: "Calibri" } })],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  };
}

// ─── TOC Section ───
function buildTOC() {
  return {
    properties: {
      type: SectionType.NEXT_PAGE,
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
        pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN },
      },
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: c(P.secondary) })],
        })],
      }),
    },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 480, after: 360 },
        children: [new TextRun({ text: "Table of Contents", bold: true, size: 32, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "SimHei" } })],
      }),
      new TableOfContents("TOC", {
        hyperlink: true,
        headingStyleRange: "1-3",
      }),
      new Paragraph({
        spacing: { before: 200 },
        children: [new TextRun({ text: "Note: Right-click the TOC and select \"Update Field\" to refresh page numbers.", italics: true, size: 18, color: "888888" })],
      }),
      new Paragraph({ children: [new PageBreak()] }),
    ],
  };
}

// ─── Body Section ───
function buildBody() {
  const children = [];

  // ══════════════════════════════════════════════
  // CHAPTER 1: Prerequisites
  // ══════════════════════════════════════════════
  children.push(h1("1. Prerequisites"));
  children.push(body("Before setting up the ALADIN platform for local development and Netlify deployment, ensure your system meets the following requirements. This guide covers the complete workflow from cloning the project to having it live on the internet with Neon PostgreSQL as the database backend."));

  children.push(h2("1.1 Required Software"));
  children.push(body("You will need the following tools installed on your local machine. All of them are free and widely used in the Node.js ecosystem. Make sure to install them before proceeding with the setup process."));

  children.push(makeTable(
    ["Software", "Minimum Version", "Purpose", "Download URL"],
    [
      ["Node.js", "v18.17+", "JavaScript runtime for building and running the app", "https://nodejs.org"],
      ["npm or pnpm", "npm 9+ / pnpm 8+", "Package manager for installing dependencies", "https://nodejs.org (npm included)"],
      ["Git", "2.30+", "Version control to clone and manage the repository", "https://git-scm.com"],
      ["VS Code (Recommended)", "Latest", "Code editor with excellent TypeScript/Next.js support", "https://code.visualstudio.com"],
      ["Prisma CLI", "Installed via npm", "Database schema management and migrations", "npx prisma (auto-installed)"],
    ]
  ));
  children.push(spacer(120));

  children.push(h2("1.2 Required Accounts"));
  children.push(body("You will also need accounts on the following platforms. All three offer free tiers that are more than sufficient for development and initial production deployment of the ALADIN platform. Each service has a generous free tier that can handle moderate traffic volumes, which is ideal for early-stage B2B platforms."));

  children.push(makeTable(
    ["Platform", "Account URL", "Free Tier", "Purpose"],
    [
      ["GitHub", "https://github.com", "Unlimited public repos", "Host your source code repository"],
      ["Neon", "https://neon.tech", "0.5 GB storage, always-free", "Managed PostgreSQL database"],
      ["Netlify", "https://netlify.com", "100 GB bandwidth/month, 300 build min", "Hosting and deployment platform"],
    ]
  ));
  children.push(spacer(120));

  // ══════════════════════════════════════════════
  // CHAPTER 2: Local Development Setup
  // ══════════════════════════════════════════════
  children.push(h1("2. Local Development Setup"));
  children.push(body("This chapter walks you through setting up the ALADIN platform on your local machine. Follow each step carefully, as the order matters. The process involves cloning the code, installing dependencies, configuring the database, and running the development server."));

  children.push(h2("2.1 Clone the Repository"));
  children.push(body("First, clone the project repository to your local machine. If you are working from a different codebase, ensure the project structure matches the ALADIN Next.js App Router architecture with the src/app directory structure. Navigate to the directory where you want to keep your projects and run the following commands:"));

  children.push(...codeBlock([
    "# Clone the repository (replace with your actual repo URL)",
    "git clone https://github.com/your-username/aladin-platform.git",
    "",
    "# Navigate into the project directory",
    "cd aladin-platform",
    "",
    "# Verify the project structure",
    "ls -la",
  ]));
  children.push(spacer(80));

  children.push(h2("2.2 Install Dependencies"));
  children.push(body("The project uses a combination of production and development dependencies managed through npm. The package.json includes a postinstall script that automatically generates the Prisma client after installation. Run the following command to install all required packages:"));

  children.push(...codeBlock([
    "# Install all dependencies (production + dev)",
    "npm install",
    "",
    "# This automatically runs: npx prisma generate",
    "# which creates the Prisma Client in node_modules/.prisma/client",
    "",
    "# Verify installation by checking the node_modules folder",
    "ls node_modules | head -20",
  ]));
  children.push(spacer(80));

  children.push(body("If you encounter any permission errors on Linux or macOS, you may need to prefix the command with sudo or configure your npm permissions. On Windows, make sure you are running your terminal as Administrator if you encounter permission-related issues."));

  children.push(h2("2.3 Configure Environment Variables"));
  children.push(body("Create a .env.local file in the project root directory. This file should contain your local development configuration. Never commit this file to version control. The .gitignore file already excludes .env* files, so your secrets will remain safe. Copy the following template and replace the placeholder values:"));

  children.push(...codeBlock([
    "# Create .env.local in the project root",
    "",
    "# Database - Use Neon connection string (see Chapter 3)",
    'DATABASE_URL="postgresql://neondb_owner:YOUR_PASSWORD@ep-xxxxx.us-east-2.aws.neon.tech/neondb?sslmode=require&connect_timeout=10"',
    'DIRECT_DATABASE_URL="postgresql://neondb_owner:YOUR_PASSWORD@ep-xxxxx.us-east-2.aws.neon.tech/neondb?sslmode=require"',
    "",
    "# JWT Secrets - Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    'JWT_SECRET="your-generated-32-char-random-string-here"',
    'JWT_REFRESH_SECRET="another-generated-32-char-random-string-here"',
    "",
    "# App Config",
    'NEXT_PUBLIC_APP_NAME="ALADIN"',
    'NEXT_PUBLIC_APP_URL="http://localhost:3000"',
  ]));
  children.push(spacer(80));

  children.push(body("To generate strong random secrets for JWT_SECRET and JWT_REFRESH_SECRET, run this command in your terminal:"));
  children.push(...codeBlock([
    'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
  ]));
  children.push(body("Run this command twice to generate two different secrets, one for the access token and one for the refresh token. Copy and paste each output into the corresponding environment variable."));

  children.push(h2("2.4 Push Database Schema to Neon"));
  children.push(body("The Prisma schema has already been configured for PostgreSQL (see prisma/schema.prisma). After setting up your Neon database (Chapter 3) and updating the DATABASE_URL in your .env.local file, push the schema to create all tables in your Neon PostgreSQL database:"));

  children.push(...codeBlock([
    "# Push the Prisma schema to your Neon database",
    "npx prisma db push",
    "",
    "# Expected output:",
    "# Your database is now in sync with your Prisma schema.",
    "",
    "# Verify tables were created",
    "npx prisma db execute --stdin",
    "# Then type: SELECT tablename FROM pg_tables WHERE schemaname = 'public';",
    "# Press Ctrl+D to execute",
  ]));
  children.push(spacer(80));

  children.push(body("The prisma db push command will create all 17 tables in your Neon database: User, Shop, Ward, Category, Product, Manufacturer, Distributor, Order, OrderItem, Transaction, GroupDeal, GroupDealParticipant, Shipment, Promotion, PromotionItem, MerchandisingAudit, Broker, Payment, AuditLog, and PlatformSetting. This command is safe to run multiple times as it only creates tables that do not exist or updates schemas for tables that have changed."));

  children.push(h2("2.5 (Optional) Seed the Database"));
  children.push(body("If you have seed data or want to create an initial admin user, you can run the seed script. This step is optional but recommended for local development so you have test data to work with. The seed script creates sample shops, products, categories, and an admin user account."));

  children.push(...codeBlock([
    "# Run the database seed script",
    "npx prisma db seed",
    "",
    "# Or manually seed using a script",
    "npx tsx prisma/seed.ts",
  ]));
  children.push(spacer(80));

  children.push(h2("2.6 Run the Development Server"));
  children.push(body("Now you are ready to start the development server. The Next.js development server supports hot module reloading, which means any changes you make to the source code will be immediately reflected in your browser without a full page refresh. Open a terminal in your project root and run:"));

  children.push(...codeBlock([
    "# Start the development server",
    "npm run dev",
    "",
    "# Expected output:",
    "#   > next dev -p 3000",
    "#   - Local:    http://localhost:3000",
    "#   - Environments: .env.local",
    "",
    "# Open your browser and navigate to:",
    "# http://localhost:3000",
  ]));
  children.push(spacer(80));

  children.push(body("The ALADIN platform has 21 main pages and over 90 API routes. You can verify everything is working by navigating through the sidebar navigation to each section: Dashboard, Orders, Products, Shops, Group Buy, Credit, Supply Chain, Brokers, Reports, Trade Marketing, and Settings."));

  // ══════════════════════════════════════════════
  // CHAPTER 3: Neon PostgreSQL Setup
  // ══════════════════════════════════════════════
  children.push(h1("3. Neon PostgreSQL Setup"));
  children.push(body("Neon provides a fully managed PostgreSQL database with a generous free tier that is perfect for the ALADIN platform. Neon databases are serverless and scale to zero when not in use, meaning you only pay for active usage. The free tier includes 0.5 GB of storage, which is sufficient for thousands of orders, products, and user accounts in the early stages."));

  children.push(h2("3.1 Create a Neon Account"));
  children.push(body("Navigate to https://neon.tech and sign up for a free account. You can sign up using GitHub, Google, or email. After verifying your email address, you will be taken to the Neon console where you can create your first project."));

  children.push(h2("3.2 Create a New Project"));
  children.push(body("In the Neon console, click the \"Create Project\" button. You will be prompted to choose a region, database name, and branch name. Follow these steps carefully to ensure optimal connectivity from both your local machine and Netlify:"));

  children.push(makeTable(
    ["Setting", "Recommended Value", "Notes"],
    [
      ["Region", "US East (Ohio) or AWS Asia Pacific (Singapore)", "Choose the region closest to your users for lowest latency"],
      ["Database Name", "neondb (default)", "Leave as default unless you have specific naming requirements"],
      ["Branch Name", "main (default)", "Leave as default; branches work like Git branches for databases"],
      ["Compute Size", "Free tier (0.25 vCPU, 1 GB RAM)", "Sufficient for development and early production"],
    ]
  ));
  children.push(spacer(120));

  children.push(body("After creating the project, you will see your connection details in the Neon dashboard. You need two connection strings: a Direct connection string (for local development and schema migrations) and a Pooled connection string (for Netlify serverless functions)."));

  children.push(h2("3.3 Get Your Connection Strings"));
  children.push(body("In your Neon project dashboard, navigate to the Connection Details panel. You will see two types of connection strings. Both are important and serve different purposes in the deployment architecture."));

  children.push(h3("Direct Connection (for local dev & migrations)"));
  children.push(body("This connection string establishes a direct TCP connection to your Neon database. Use this for local development, running Prisma migrations, and any administrative database operations. It provides the most reliable connection for schema changes."));

  children.push(...codeBlock([
    "# Example Direct Connection String:",
    "postgresql://neondb_owner:abc123xyz@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require",
    "",
    "# Use this as DIRECT_DATABASE_URL in .env.local",
    "# Also use this as DATABASE_URL for local development",
  ]));
  children.push(spacer(80));

  children.push(h3("Pooled Connection (for Netlify serverless)"));
  children.push(body("The pooled connection string uses Neon's connection pooler to efficiently manage database connections in a serverless environment like Netlify. This is critical because serverless functions can create many short-lived connections, and the pooler prevents exhausting your database's connection limit. The pooled connection string typically ends with -pooler in the hostname."));

  children.push(...codeBlock([
    "# Example Pooled Connection String:",
    "postgresql://neondb_owner:abc123xyz@ep-cool-name-123456-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require",
    "",
    "# Use this as DATABASE_URL in Netlify environment variables",
    "# Note the -pooler suffix in the hostname",
  ]));
  children.push(spacer(80));

  children.push(h2("3.4 Important: Prisma with Neon Pooling"));
  children.push(body("Prisma uses two environment variables when working with connection pooling. The schema file (prisma/schema.prisma) has been configured with both url and directUrl fields. Here is how they work together in different environments:"));

  children.push(makeTable(
    ["Environment", "DATABASE_URL", "DIRECT_DATABASE_URL"],
    [
      ["Local Development", "Direct connection string", "Direct connection string (same)"],
      ["Netlify Deployment", "Pooled connection string (-pooler)", "Direct connection string"],
    ]
  ));
  children.push(spacer(120));

  children.push(body("The directUrl is used by Prisma for schema migrations (prisma db push, prisma migrate) because these operations require a direct connection. The url field is used by the Prisma Client at runtime, which should use the pooled connection in serverless environments for optimal performance and connection management."));

  // ══════════════════════════════════════════════
  // CHAPTER 4: Deploy to Netlify
  // ══════════════════════════════════════════════
  children.push(h1("4. Deploy to Netlify"));
  children.push(body("Netlify provides seamless deployment for Next.js applications with server-side rendering and API routes. The ALADIN platform uses Next.js App Router with API routes, which Netlify fully supports through its built-in Next.js runtime and the @netlify/plugin-nextjs plugin. This chapter covers the complete deployment process from pushing code to GitHub to going live."));

  children.push(h2("4.1 Push Code to GitHub"));
  children.push(body("Before deploying to Netlify, push your project to a GitHub repository. Netlify can automatically deploy from GitHub, which enables continuous deployment every time you push changes. This workflow is highly recommended as it provides version control, collaboration, and automatic deployments."));

  children.push(...codeBlock([
    "# Initialize git (if not already done)",
    "git init",
    "",
    "# Add all project files",
    "git add .",
    "",
    "# Create initial commit",
    'git commit -m "Initial commit: ALADIN B2B Platform"',
    "",
    "# Add your GitHub repository as remote",
    "git remote add origin https://github.com/your-username/aladin-platform.git",
    "",
    "# Push to GitHub",
    "git push -u origin main",
  ]));
  children.push(spacer(80));

  children.push(body("Make sure your .gitignore file includes the following entries to prevent sensitive data and build artifacts from being committed to the repository. The .gitignore in the project root should already have these entries, but double-check:"));

  children.push(...codeBlock([
    "# .gitignore - Must include these entries:",
    ".env*",
    ".env.local",
    "node_modules/",
    ".next/",
    "*.log",
    "db/*.db",
    "db/*.db-journal",
  ]));

  children.push(h2("4.2 Create Netlify Site"));
  children.push(body("Log in to your Netlify account at https://app.netlify.com. If you do not have an account yet, sign up for free using GitHub, GitLab, or email. Once logged in, follow these steps to create a new site from your GitHub repository:"));

  children.push(makeTable(
    ["Step", "Action", "Details"],
    [
      ["1", "Click \"Add new site\" > \"Import an existing project\"", "This connects Netlify to your GitHub repo"],
      ["2", "Select \"GitHub\" as the Git provider", "Authorize Netlify to access your repositories"],
      ["3", "Select the aladin-platform repository", "Choose the repo you just pushed"],
      ["4", "Configure build settings (see Section 4.3)", "Set the correct build command and publish directory"],
      ["5", "Click \"Deploy site\"", "Netlify will build and deploy your app"],
    ]
  ));
  children.push(spacer(120));

  children.push(h2("4.3 Configure Build Settings"));
  children.push(body("On the Netlify build configuration page, set the following values. These settings tell Netlify how to build your Next.js application. The netlify.toml file in the project root provides these settings automatically, but you can also configure them manually in the Netlify dashboard as a fallback."));

  children.push(makeTable(
    ["Setting", "Value", "Explanation"],
    [
      ["Build command", "npm run build", "Runs prisma generate + next build"],
      ["Publish directory", ".next", "Netlify reads from the .next output folder"],
      ["Node.js version", "18 or 20", "Select in Site settings > Build & deploy > Environment"],
      ["Framework preset", "Next.js", "Auto-detected by Netlify from the config files"],
    ]
  ));
  children.push(spacer(120));

  children.push(body("The netlify.toml file in your project root already includes these build settings along with the @netlify/plugin-nextjs plugin configuration. If the file is present in your repository, Netlify will automatically detect it and use those settings. You should not need to manually configure these values in the dashboard, but it is good to verify they match."));

  children.push(h2("4.4 Set Environment Variables in Netlify"));
  children.push(body("This is a critical step. Your application needs environment variables to connect to the database and handle authentication. Navigate to your Netlify site dashboard, then go to Site configuration > Environment variables. Add the following variables for both Production and Preview deployment contexts:"));

  children.push(makeTable(
    ["Variable Name", "Value", "Context"],
    [
      ["DATABASE_URL", "Your Neon POOLED connection string", "Production + Preview"],
      ["DIRECT_DATABASE_URL", "Your Neon DIRECT connection string", "Production + Preview"],
      ["JWT_SECRET", "A strong random string (32+ chars)", "Production + Preview"],
      ["JWT_REFRESH_SECRET", "Another strong random string (32+ chars)", "Production + Preview"],
      ["NEXT_PUBLIC_APP_NAME", "ALADIN", "Production + Preview"],
      ["NEXT_PUBLIC_APP_URL", "https://your-site-name.netlify.app", "Production only"],
    ]
  ));
  children.push(spacer(120));

  children.push(bodyRuns([
    bold("IMPORTANT: "),
    normal("For the DATABASE_URL in Netlify, you MUST use the "),
    bold("pooled connection string"),
    normal(" (the one with -pooler in the hostname). This ensures that Netlify serverless functions can efficiently share database connections. Using the direct connection string in Netlify will cause connection exhaustion errors under load. The DIRECT_DATABASE_URL should be the non-pooled string, as Prisma needs it for schema migrations."),
  ]));

  children.push(h2("4.5 Understanding the netlify.toml Configuration"));
  children.push(body("The project includes a netlify.toml configuration file at the root. This file tells Netlify how to build, deploy, and run your Next.js application. Here is what each section does:"));

  children.push(...codeBlock([
    "# netlify.toml - Full configuration explained",
    "",
    '[build]',
    '# Build command runs Prisma generate (creates DB client) then Next.js build',
    'command = "npx prisma generate && npx prisma db push && next build"',
    '# The .next directory contains the build output',
    'publish = ".next"',
    "",
    '[[plugins]]',
    '# The official Netlify plugin for Next.js support',
    '# Handles SSR, API routes, image optimization, and edge functions',
    'package = "@netlify/plugin-nextjs"',
    "",
    '[functions]',
    '# Use esbuild for faster function bundling',
    'node_bundler = "esbuild"',
  ]));
  children.push(spacer(80));

  children.push(bodyRuns([
    bold("Note: "),
    normal("The build command includes "),
    code("prisma db push"),
    normal(" which ensures your database schema is always in sync with your Prisma schema file. This is useful for initial deployments but can be removed in production if you prefer to manage migrations manually using "),
    code("prisma migrate deploy"),
    normal(" instead."),
  ]));

  children.push(h2("4.6 Deploy and Verify"));
  children.push(body("After configuring all settings and environment variables, trigger a new deploy. You can do this by pushing a new commit to your GitHub repository or by clicking the \"Trigger deploy\" button in the Netlify dashboard. The build process typically takes 2-5 minutes depending on your project size."));

  children.push(...codeBlock([
    "# Trigger a new deploy by pushing to GitHub:",
    'git commit --allow-empty -m "Trigger Netlify deploy"',
    "git push",
    "",
    "# Or trigger from Netlify dashboard:",
    "# Site dashboard > Deploys > Trigger deploy > Deploy site",
  ]));
  children.push(spacer(80));

  children.push(body("After the build completes, Netlify will assign a unique URL to your site (e.g., https://random-name-12345.netlify.app). You can customize this in Site settings > Domain management. Test all the critical pages and API endpoints to verify everything is working:"));

  children.push(makeTable(
    ["Page", "URL Path", "Expected Result"],
    [
      ["Dashboard", "/", "Loads ALADIN dashboard with sidebar"],
      ["Orders", "/orders", "Shows orders list page"],
      ["Products", "/products", "Shows product catalog"],
      ["Shops", "/shops", "Shows shop management"],
      ["API Health Check", "/api", "Returns API status"],
      ["Login API", "POST /api/auth/login", "Returns JWT tokens"],
    ]
  ));
  children.push(spacer(120));

  // ══════════════════════════════════════════════
  // CHAPTER 5: Project Configuration Details
  // ══════════════════════════════════════════════
  children.push(h1("5. Project Configuration Details"));
  children.push(body("This chapter provides detailed explanations of the key configuration files that have been prepared for the deployment. Understanding these files will help you troubleshoot issues and customize the deployment for your specific needs."));

  children.push(h2("5.1 Prisma Schema (PostgreSQL)"));
  children.push(body("The prisma/schema.prisma file has been updated from SQLite to PostgreSQL for Neon deployment. The key change is in the datasource configuration block. Here is what changed and why:"));

  children.push(...codeBlock([
    "# BEFORE (SQLite - development only):",
    'datasource db {',
    '  provider = "sqlite"',
    '  url      = env("DATABASE_URL")',
    '}',
    "",
    "# AFTER (PostgreSQL - Neon deployment):",
    'datasource db {',
    '  provider  = "postgresql"',
    '  url       = env("DATABASE_URL")',
    '  directUrl = env("DIRECT_DATABASE_URL")',
    '}',
  ]));
  children.push(spacer(80));

  children.push(body("The directUrl field tells Prisma to use a direct connection for schema migrations, while the url field is used by the Prisma Client at runtime. In a serverless environment like Netlify, the runtime connection should use the pooled connection string to avoid exhausting database connections."));

  children.push(body("The schema contains 20 models covering the entire ALADIN business domain: User, Shop, Ward, Category, Product, Manufacturer, Distributor, Order, OrderItem, Transaction, GroupDeal, GroupDealParticipant, Shipment, Promotion, PromotionItem, MerchandisingAudit, Broker, Payment, AuditLog, and PlatformSetting. All models use cuid() for primary keys, DateTime with @default(now()) for timestamps, and soft deletes via deletedAt fields."));

  children.push(h2("5.2 Next.js Configuration"));
  children.push(body("The next.config.ts file has been updated to work with Netlify. The standalone output mode has been removed because Netlify uses its own deployment format through the @netlify/plugin-nextjs plugin. Here is the current configuration:"));

  children.push(...codeBlock([
    "// next.config.ts - Netlify-compatible configuration",
    "import type { NextConfig } from \"next\";",
    "",
    "const nextConfig: NextConfig = {",
    "  /* Netlify handles its own output format via @netlify/plugin-nextjs */",
    "  typescript: {",
    "    ignoreBuildErrors: true,",
    "  },",
    "  reactStrictMode: false,",
    "};",
    "",
    "export default nextConfig;",
  ]));
  children.push(spacer(80));

  children.push(body("The typescript ignoreBuildErrors option is enabled because the project was developed rapidly and may have some TypeScript strict mode warnings. You can set this to false once all type errors are resolved. The reactStrictMode is set to false to prevent double-rendering during development, which can cause issues with some API calls."));

  children.push(h2("5.3 Package.json Scripts"));
  children.push(body("The package.json scripts have been updated for both local development and Netlify deployment. The postinstall script ensures that Prisma Client is automatically generated after every npm install, which is critical for Netlify builds. Here are all the available scripts:"));

  children.push(makeTable(
    ["Script", "Command", "When to Use"],
    [
      ["npm run dev", "next dev -p 3000", "Local development with hot reload"],
      ["npm run build", "npx prisma generate && next build", "Production build (Netlify uses this)"],
      ["npm start", "next start", "Start production server locally"],
      ["npm run db:push", "npx prisma db push", "Push schema changes to database"],
      ["npm run db:generate", "npx prisma generate", "Regenerate Prisma Client only"],
      ["npm run db:migrate", "npx prisma migrate dev", "Create a new database migration"],
      ["npm run db:seed", "npx prisma db seed", "Seed database with sample data"],
    ]
  ));
  children.push(spacer(120));

  // ══════════════════════════════════════════════
  // CHAPTER 6: Troubleshooting
  // ══════════════════════════════════════════════
  children.push(h1("6. Troubleshooting"));
  children.push(body("This chapter covers the most common issues you may encounter during local setup and Netlify deployment, along with their solutions. If you run into a problem not listed here, check the Netlify deploy logs and browser console for error messages."));

  children.push(h2("6.1 Build Failures"));
  children.push(h3("Prisma Generate Fails During Build"));
  children.push(bodyRuns([
    normal("If the Netlify build fails during the "),
    code("prisma generate"),
    normal(" step, it usually means the Prisma schema has a syntax error or the Prisma version is mismatched. Verify your prisma/schema.prisma file is valid by running "),
    code("npx prisma validate"),
    normal(" locally. Also ensure that both @prisma/client and prisma in package.json have the same version number (e.g., both ^6.11.1)."),
  ]));

  children.push(h3("Next.js Build Memory Exhaustion"));
  children.push(body("Netlify's free tier has limited build memory. If your build fails with an out-of-memory error, try setting the NODE_OPTIONS environment variable in Netlify to increase the memory limit. Go to Site settings > Environment variables and add NODE_OPTIONS=--max-old-space-size=4096. This gives the Node.js build process 4 GB of memory, which is sufficient for most Next.js applications."));

  children.push(h3("Module Not Found Errors"));
  children.push(body("If you see \"Module not found\" errors during the build, ensure that all dependencies are listed in the dependencies section of package.json (not just devDependencies). Netlify only installs production dependencies by default. The z-ai-web-dev-sdk package should be removed from dependencies if it is only used in the development sandbox and not needed in production."));

  children.push(h2("6.2 Database Connection Issues"));
  children.push(h3("Connection Refused / Timeout"));
  children.push(body("If your application cannot connect to the Neon database, verify the following: (1) The DATABASE_URL is correct and includes sslmode=require, (2) The Neon project is not suspended (check the Neon dashboard), (3) Your IP is not blocked, (4) The database branch exists and is active. Neon databases auto-suspend after inactivity but wake up within seconds of a new connection request."));

  children.push(h3("Too Many Connections"));
  children.push(body("If you see \"too many connections\" errors, ensure you are using the pooled connection string (with -pooler in the hostname) for the DATABASE_URL environment variable on Netlify. The pooled connection uses PgBouncer to manage connections efficiently. Also verify that you are not creating new PrismaClient instances on every request. The project's db.ts file uses a global singleton pattern to prevent this."));

  children.push(h2("6.3 Runtime Errors"));
  children.push(h3("API Routes Return 500"));
  children.push(body("If your API routes return 500 errors after deployment, check the Netlify function logs in Site dashboard > Logs > Functions. Common causes include: missing environment variables (especially JWT_SECRET and DATABASE_URL), Prisma Client not generated during build, or TypeScript errors that were suppressed locally but cause runtime failures. Also ensure that the netlify.toml file has the correct publish directory (.next) and build command."));

  children.push(h3("Pages Not Found (404)"));
  children.push(body("If some pages return 404 errors, verify that the @netlify/plugin-nextjs plugin is properly installed. The plugin should be automatically installed during the build if it is listed in netlify.toml. You can also check the deployed .next directory structure to ensure all route pages were built. Make sure there is no conflicting app/ directory at the project root (outside of src/app), as this can interfere with Next.js App Router routing."));

  children.push(h2("6.4 Quick Diagnostic Commands"));
  children.push(body("Run these commands locally to diagnose common issues before deploying to Netlify:"));

  children.push(...codeBlock([
    "# 1. Validate Prisma schema",
    "npx prisma validate",
    "",
    "# 2. Test database connection",
    "npx prisma db execute --stdin",
    "# Type: SELECT 1; then Ctrl+D",
    "",
    "# 3. Generate Prisma Client",
    "npx prisma generate",
    "",
    "# 4. Build locally to catch errors before deploying",
    "npm run build",
    "",
    "# 5. Check for TypeScript errors",
    "npx tsc --noEmit",
    "",
    "# 6. Verify all routes",
    "# Start dev server, then test key endpoints",
  ]));

  // ══════════════════════════════════════════════
  // CHAPTER 7: Quick Reference Checklist
  // ══════════════════════════════════════════════
  children.push(h1("7. Quick Reference Checklist"));
  children.push(body("Use this checklist to ensure you have completed all the necessary steps for both local development and Netlify deployment. Check each item as you complete it to track your progress through the setup process."));

  children.push(h2("7.1 Local Development Checklist"));
  children.push(makeTable(
    ["#", "Task", "Command / Action"],
    [
      ["1", "Install Node.js 18+", "Download from https://nodejs.org"],
      ["2", "Clone the repository", "git clone https://github.com/your-username/aladin-platform.git"],
      ["3", "Install dependencies", "npm install"],
      ["4", "Create Neon database", "Sign up at https://neon.tech and create a project"],
      ["5", "Get connection strings", "Copy both Direct and Pooled strings from Neon dashboard"],
      ["6", "Create .env.local file", "Copy env-example.txt and fill in your Neon credentials"],
      ["7", "Push database schema", "npx prisma db push"],
      ["8", "Start development server", "npm run dev"],
      ["9", "Open browser", "Navigate to http://localhost:3000"],
    ]
  ));
  children.push(spacer(120));

  children.push(h2("7.2 Netlify Deployment Checklist"));
  children.push(makeTable(
    ["#", "Task", "Command / Action"],
    [
      ["1", "Push code to GitHub", "git push origin main"],
      ["2", "Create Netlify site", "Import from GitHub at https://app.netlify.com"],
      ["3", "Configure build settings", "Command: npm run build, Publish: .next"],
      ["4", "Set DATABASE_URL", "Use POOLED connection string (with -pooler)"],
      ["5", "Set DIRECT_DATABASE_URL", "Use DIRECT connection string (without -pooler)"],
      ["6", "Set JWT_SECRET", "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""],
      ["7", "Set JWT_REFRESH_SECRET", "Generate another random string (same command as above)"],
      ["8", "Set NEXT_PUBLIC_APP_URL", "https://your-site-name.netlify.app"],
      ["9", "Trigger deploy", "Push a commit or click \"Trigger deploy\""],
      ["10", "Verify deployment", "Test key pages: /, /orders, /products, /api"],
    ]
  ));

  return {
    properties: {
      type: SectionType.NEXT_PAGE,
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
        pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: "ALADIN Deployment Guide", size: 16, color: c(P.secondary), font: { ascii: "Calibri" } })],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: c(P.secondary) })],
        })],
      }),
    },
    children,
  };
}

// ─── Assemble Document ───
async function main() {
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
            size: 22,
            color: c(P.body),
          },
          paragraph: {
            spacing: { line: 312 },
          },
        },
        heading1: {
          run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 32, bold: true, color: c(P.primary) },
          paragraph: { spacing: { before: 480, after: 200, line: 312 } },
        },
        heading2: {
          run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 28, bold: true, color: c(P.primary) },
          paragraph: { spacing: { before: 360, after: 160, line: 312 } },
        },
        heading3: {
          run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 24, bold: true, color: c(P.accent) },
          paragraph: { spacing: { before: 240, after: 120, line: 312 } },
        },
      },
    },
    sections: [
      buildCover(),
      buildTOC(),
      buildBody(),
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const outputPath = "/home/z/my-project/download/ALADIN-Deployment-Guide.docx";
  fs.writeFileSync(outputPath, buffer);
  console.log("Document generated: " + outputPath);
}

main().catch(console.error);
