# VibeGit 🎨

**VibeGit** is a collaborative social platform for developers, designers, and creators to share projects, ideas, and connect with others. It combines features of GitHub, Pinterest, and a social network to foster creative collaboration.

## 🌟 Features

### Core Functionality
- **Project Showcase**: Share and discover projects with rich descriptions, images, and file uploads
- **Project IDE**: Built-in Monaco Editor for browsing and editing project files
- **Social Feed**: Explore trending projects and activity from the community
- **User Profiles**: Customizable profiles with project portfolios and activity history
- **Direct Messaging**: Real-time chat between users for collaboration
- **Activity Feed**: Track project updates, user activities, and community engagement
- **Project Search**: Advanced search to find projects, users, and ideas
- **Sync Requests**: Manage and track project synchronization/collaboration requests

### Theme & UI
- **Night Sky Theme**: Animated starfield background with smooth animations
- **Ocean Mode**: Alternative oceanic visual theme with wave effects
- **Responsive Design**: Fully responsive UI built with React
- **Monaco Editor Integration**: Professional code editor for file viewing and editing

### User Management
- **Authentication**: Secure JWT-based authentication with bcrypt password hashing
- **User Roles**: Support for different user roles and permissions
- **Profile Customization**: Edit profile information, avatar, and bio

## 🛠️ Tech Stack

### Frontend
- **React** 18.2.0 - UI framework
- **React Router DOM** 6.22.0 - Routing and navigation
- **Monaco Editor** - Code editor component
- **Axios** - HTTP client for API requests
- **YAML** - YAML parsing support
- **TypeScript** - Type safety for development

### Backend
- **Express.js** 5.2.1 - Web server framework
- **MongoDB** with Mongoose 7.8.7 - Database
- **JWT** 9.0.3 - Authentication tokens
- **bcryptjs** 3.0.3 - Password encryption
- **Multer** 2.1.1 - File upload handling
- **CORS** 2.8.6 - Cross-origin requests
- **dotenv** 17.3.1 - Environment configuration
- **adm-zip** - ZIP file handling

## 📁 Project Structure

```
vibegit-final/
├── frontend/                    # React frontend application
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── pages/              # Page components (Feed, Profile, Create, etc.)
│   │   ├── context/            # React Context (Auth, Theme)
│   │   ├── api/                # API integration layer
│   │   ├── utils/              # Utility functions
│   │   ├── App.jsx             # Main app component
│   │   ├── index.js            # React entry point
│   │   └── index.css           # Global styles
│   └── package.json
│
├── backend/                     # Express.js backend server
│   ├── routes/                 # API route handlers
│   │   ├── authRoutes.js       # Authentication endpoints
│   │   ├── projectRoutes.js    # Project endpoints
│   │   ├── userRoutes.js       # User endpoints
│   │   ├── messageRoutes.js    # Messaging endpoints
│   │   ├── activityRoutes.js   # Activity feed endpoints
│   │   └── ...
│   ├── models/                 # MongoDB schemas
│   ├── middleware/             # Express middleware
│   ├── server.js               # Express server setup
│   ├── package.json
│   └── uploads/                # File upload storage
│
└── VibeGit.jpg                # Project logo/image

```

## 🚀 Getting Started

### Prerequisites
- Node.js (v14+)
- MongoDB (local or MongoDB Atlas)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/dasmiita/vibegit-final.git
   cd vibegit-final
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   ```

   Create a `.env` file in the backend directory:
   ```
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key
   PORT=5000
   RENDER_EXTERNAL_URL=your_render_url (optional)
   ```

   Start the backend:
   ```bash
   npm start
   # or for development with auto-reload
   npm run dev
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   ```

   Start the frontend development server:
   ```bash
   npm start
   ```

   The application will open at `http://localhost:3000`

### Available Scripts

**Frontend:**
- `npm start` - Run development server
- `npm build` - Build for production

**Backend:**
- `npm start` - Start the server
- `npm run dev` - Start with development mode

## 🔌 API Endpoints

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout

### Projects
- `GET /projects` - Get all projects
- `GET /projects/:id` - Get project details
- `POST /projects` - Create new project
- `PUT /projects/:id` - Update project
- `DELETE /projects/:id` - Delete project

### Users
- `GET /users/:id` - Get user profile
- `PUT /users/:id` - Update user profile
- `GET /users/:id/projects` - Get user's projects

### Messages
- `GET /messages/:userId` - Get messages with user
- `POST /messages` - Send message
- `GET /messages` - Get all conversations

### Activity
- `GET /activity` - Get activity feed
- `POST /activity` - Create activity

### Branches
- `GET /branches/:projectId` - Get project branches
- `POST /branches` - Create branch
- `PUT /branches/:id` - Update branch

## 🎨 Key Components

### Frontend Components
- **Navbar** - Navigation bar with user info
- **ChatModal** - Direct messaging interface
- **NightSky** - Animated starfield background
- **OceanBackground** - Ocean theme background

### Frontend Pages
- **Explore** - Discover projects
- **Feed** - Social feed view
- **Create** - Create new projects
- **Profile** - User profile view
- **EditProfile** - Profile editing
- **ProjectDetail** - Individual project details
- **ProjectIDE** - In-browser code editor
- **Search** - Search functionality
- **ActivityFeed** - Activity tracking

## 🔐 Security Features

- JWT-based authentication
- Bcrypt password hashing
- CORS enabled for secure cross-origin requests
- Environment variable configuration for sensitive data
- Role-based access control

## 📊 Language Composition

- **JavaScript**: 71.9%
- **CSS**: 27.9%
- **HTML**: 0.2%

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is licensed under the ISC License.

## 👤 Author

**Dasmiita** - [GitHub Profile](https://github.com/dasmiita)

## 📧 Support

For questions or issues, please open an issue on the GitHub repository.

---

**Last Updated**: April 13, 2026