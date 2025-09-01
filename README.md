# Authentication Service

A comprehensive authentication and project management system built with Node.js and Express. This service provides user authentication, role-based access control, and project management capabilities with a clean web interface.

## 🚀 Features

- **User Authentication**: Secure registration and login with JWT tokens
- **Project Management**: Create, modify, and delete projects with custom permissions
- **Role-Based Access Control**: Fine-grained permissions system (viewer, editor, analytics, etc.)
- **Admin Panel**: Complete user management for administrators
- **Security First**: Rate limiting, security headers, and secure password hashing
- **Web Interface**: Clean, responsive EJS-based UI
- **Database**: SQLite for simple deployment and data persistence

## 🛠️ Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite (better-sqlite3)
- **Authentication**: JWT tokens, Argon2/bcrypt password hashing
- **Frontend**: EJS templates, Vanilla JavaScript
- **Security**: express-rate-limit, security headers
- **Validation**: Joi for input validation

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm or yarn package manager

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Null-Austin-Industries/Authincation-service.git
   cd Authincation-service
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .example.env .env
   ```
   
   Edit the `.env` file to configure your settings:
   ```env
   PORT=3000
   JWT_SECRET=your-super-secret-jwt-key-here
   Admin=admin
   Admin_Password=secure-admin-password
   ```

4. **Start the application**
   ```bash
   npm start
   ```

The application will be available at `http://localhost:3000`

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `JWT_SECRET` | Secret key for JWT token signing | Required |
| `Admin` | Default admin username | admin |
| `Admin_Password` | Default admin password | admin |

**⚠️ Security Note**: Always change the default admin credentials and use a strong JWT secret in production!

## 🏗️ Project Structure

```
src/
├── app.js              # Main application entry point
├── libs/
│   ├── auth.js         # Authentication logic and user management
│   └── db.js           # Database setup and migrations
├── pages/              # EJS templates
│   ├── index.ejs       # Dashboard/home page
│   ├── login.ejs       # Login page
│   ├── register.ejs    # Registration page
│   ├── projects.ejs    # Project management
│   ├── users.ejs       # User management (admin)
│   └── partials/       # Reusable template components
├── js/                 # Client-side JavaScript
│   ├── projects.js     # Project management functionality
│   └── modify-project.js # Project editing functionality
├── css/               # Stylesheets
└── db/               # SQLite database files (auto-created)
```

## 👥 Usage

### First Time Setup

1. Start the application and navigate to `http://localhost:3000`
2. You'll be redirected to the login page
3. Register a new account or use the default admin credentials
4. After logging in, you'll see the dashboard with available projects

### User Roles and Permissions

- **Admin**: Full system access, user management, all project operations
- **Editor**: Can create, modify, and delete projects
- **Viewer**: Read-only access to assigned projects
- **Custom**: Define custom permissions for specific use cases

### Managing Projects

1. **Create Project**: Click "Create Project" on the dashboard
2. **Configure**: Set name, description, link, and permissions
3. **Permissions**: Add comma-separated permissions (e.g., "viewer, editor, analytics")
4. **Access Control**: Only users with matching permissions can access the project

### User Management (Admin Only)

Navigate to the Users section to:
- View all registered users
- Reset user passwords
- Update user permissions
- Delete user accounts

## 🔐 API Endpoints

### Authentication
- `POST /register` - User registration
- `POST /login` - User login
- `GET /logout` - User logout

### Projects
- `GET /projects` - List user's accessible projects
- `POST /projects/create` - Create new project
- `POST /projects/update` - Update existing project
- `POST /projects/delete` - Delete project

### User Management (Admin)
- `GET /users` - List all users
- `POST /resetPassword` - Reset user password
- `POST /updatePermissions` - Update user permissions
- `POST /deleteAccount` - Delete user account

## 🔒 Security Features

- **Password Security**: Argon2 hashing with salt
- **JWT Authentication**: Secure token-based sessions
- **Rate Limiting**: Protection against brute force attacks
- **Security Headers**: CSRF, XSS, and clickjacking protection
- **Input Validation**: Joi-based validation on all inputs
- **SQL Injection Protection**: Prepared statements with better-sqlite3

## 🧪 Testing

```bash
npm test
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🏢 About

Developed by Austin's SDK for Null Austin Industries.

## 📞 Support

For support and questions:
- Create an issue on [GitHub Issues](https://github.com/Null-Austin-Industries/Authincation-service/issues)
- Check the documentation above
- Review the code comments for implementation details

---

**Happy coding! 🎉**