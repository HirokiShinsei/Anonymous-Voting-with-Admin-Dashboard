# 🗳️ Blind Voting System

A secure, anonymous electronic voting system with real-time results and comprehensive administrative controls.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [System Architecture](#system-architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
  - [For Voters](#for-voters)
  - [For Administrators](#for-administrators)
- [API Documentation](#api-documentation)
- [Security](#security)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## 🎯 Overview

The Blind Voting System is a modern, web-based voting platform designed to facilitate secure and anonymous elections. It features:

- **Voter Interface**: Clean, accessible voting experience with real-time validation
- **Admin Dashboard**: Comprehensive election management and monitoring
- **Blind Voting**: One-time tokens ensure voter anonymity while preventing duplicate votes
- **Real-time Results**: Live vote tallying with visual charts and statistics

## ✨ Features

### Voter Features

- ✅ **Anonymous Voting**: Token-based system ensures voter privacy
- 🔒 **Secure Authentication**: One-time use tokens prevent vote manipulation
- 📱 **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- ♿ **Accessible**: WCAG 2.1 compliant interface
- 📊 **Live Results**: View results in real-time after voting closes
- 🎨 **Modern UI**: Glass-morphism design with smooth animations

### Admin Features

- 📈 **Real-time Dashboard**: Monitor votes as they come in
- 👥 **Voter Management**: Generate and manage voting tokens
- 🎯 **Election Control**: Start, stop, and manage multiple elections
- 📊 **Analytics**: Detailed statistics and voter participation metrics
- 📥 **Export Data**: Download results in CSV or JSON format
- 🔍 **Vote Verification**: Track vote status without compromising anonymity
- 🎨 **Visual Reports**: Interactive charts and graphs
- 🔐 **Audit Trail**: Complete logging of all administrative actions

## 🏗️ System Architecture

```
voting/
├── site/                    # Voter-facing application
│   ├── index.html          # Main voting interface
│   ├── styles/
│   │   └── voting.css      # Voter interface styles
│   └── js/
│       └── voting.js       # Voting logic and API integration
│
├── admin/                   # Administrative dashboard
│   ├── dashboard.html      # Admin interface
│   ├── styles/
│   │   └── dashboard.css   # Dashboard styles
│   └── js/
│       └── dashboard.js    # Dashboard logic and controls
│
└── api/                     # Backend API (separate repository)
    ├── elections.php       # Election management endpoints
    ├── votes.php          # Vote submission and retrieval
    └── admin.php          # Administrative operations
```

## 🚀 Installation

### Prerequisites

- Web server (Apache, Nginx, or similar) OR Cloudflare Pages
- PHP 7.4 or higher (for backend API)
- MySQL 5.7 or higher
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Backend Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/voting-system.git
   cd voting-system
   ```

2. **Configure the database**
   ```bash
   mysql -u root -p < database/schema.sql
   ```

3. **Update API configuration**
   Edit `api/config.php` with your database credentials:
   ```php
   define('DB_HOST', 'localhost');
   define('DB_NAME', 'voting_system');
   define('DB_USER', 'your_username');
   define('DB_PASS', 'your_password');
   ```

4. **Set file permissions**
   ```bash
   chmod 755 api/
   chmod 644 api/*.php
   ```

### Frontend Setup

1. **Configure API endpoints**
   
   Update the API base URL in both files:
   - `site/js/voting.js`
   - `admin/js/dashboard.js`
   
   ```javascript
   const API_BASE = 'https://your-domain.com/api';
   ```

2. **Deploy to web server**
   ```bash
   # Copy files to web root
   cp -r site/ /var/www/html/vote/
   cp -r admin/ /var/www/html/vote/admin/
   ```

3. **Configure HTTPS** (recommended)
   ```bash
   # Using Let's Encrypt
   certbot --nginx -d your-domain.com
   ```

### Cloudflare Pages Deployment

#### 1. **Prepare Your Repository**

Ensure your repository structure is:
```
voting/
├── site/          # This becomes your root directory
├── admin/
└── api/           # Deploy separately to Cloudflare Workers or external server
```

#### 2. **Deploy Frontend to Cloudflare Pages**

```bash
# Login to Cloudflare
wrangler login

# Deploy the site
cd site
wrangler pages deploy . --project-name=voting-system
```

Or use the Cloudflare Dashboard:
1. Go to Pages → Create a project
2. Connect your Git repository
3. Set build configuration:
   - **Build command**: (leave empty)
   - **Build output directory**: `/site`
   - **Root directory**: `/`

#### 3. **Configure API Endpoints**

Create a file `site/js/config.js`:
```javascript
export const API_CONFIG = {
    BASE_URL: 'https://your-api-domain.com/api',
    // Or use Cloudflare Workers
    // BASE_URL: 'https://voting-api.your-domain.workers.dev'
};
```

Update `site/js/voting.js` to use this config:
```javascript
import { API_CONFIG } from './config.js';
const API_BASE = API_CONFIG.BASE_URL;
```

#### 4. **Set Environment Variables**

In Cloudflare Pages settings:
- `API_ENDPOINT`: Your backend API URL
- `ENABLE_ANALYTICS`: `true` or `false`

#### 5. **Configure Custom Domain** (Optional)

```
Pages → your-project → Custom domains → Set up custom domain
```

#### 6. **Deploy API to Cloudflare Workers** (Alternative)

```bash
# In your api directory
npm init -y
npm install @cloudflare/wrangler -g

# Create wrangler.toml
cat > wrangler.toml << EOF
name = "voting-api"
type = "javascript"
account_id = "your-account-id"
workers_dev = true
route = ""
zone_id = ""

[env.production]
vars = { ENVIRONMENT = "production" }
EOF

# Deploy
wrangler publish
```

### Troubleshooting Cloudflare Deployment

**Issue: "Loading..." stuck on screen**

This usually means the JavaScript module isn't loading. Check:

1. **File paths are correct**:
   ```javascript
   // Use relative paths without leading slash for Cloudflare Pages
   import { something } from './js/voting.js';  // ✅ Correct
   import { something } from '/js/voting.js';    // ❌ May fail
   ```

2. **CORS is configured** on your API:
   ```php
   header('Access-Control-Allow-Origin: https://your-voting-site.pages.dev');
   header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
   header('Access-Control-Allow-Headers: Content-Type');
   ```

3. **Check browser console** for errors:
   - Right-click → Inspect → Console tab
   - Look for module loading errors

4. **Verify API endpoint** is accessible:
   ```bash
   curl https://your-api-domain.com/api/elections.php
   ```

5. **Enable debug mode** in your JavaScript files temporarily:
   ```javascript
   console.log('Module loaded successfully');
   console.log('API Base:', API_BASE);
   ```

**Issue: Module not found errors**

- Ensure all imports use relative paths: `./js/voting.js` not `/js/voting.js`
- Check that all referenced files exist in your deployment
- Verify file extensions are included in import statements

**Issue: API calls failing**

1. Check Network tab in browser DevTools
2. Verify CORS headers on API responses
3. Ensure API uses HTTPS (required for Cloudflare Pages)
4. Check API endpoint configuration in your code

**Issue: 404 on routes**

Cloudflare Pages doesn't support server-side routing by default. Use:
- Hash-based routing: `#/vote` instead of `/vote`
- Or create a `_redirects` file:
  ```
  /admin/*  /admin/index.html  200
  /*        /index.html         200
  ```

### Performance Optimization for Cloudflare

```javascript
// Add to your HTML files
<link rel="modulepreload" href="./js/voting.js">
<link rel="preconnect" href="https://your-api-domain.com">
```

## ⚙️ Configuration

### Election Configuration

Elections are configured via the admin dashboard or directly in the database:

```sql
INSERT INTO elections (title, description, start_date, end_date, is_active)
VALUES (
    'Student Council Election 2024',
    'Annual election for student council representatives',
    '2024-03-01 09:00:00',
    '2024-03-03 17:00:00',
    1
);
```

### Position Configuration

```sql
INSERT INTO positions (election_id, title, description, max_choices)
VALUES (
    1,
    'President',
    'Student Council President',
    1
);
```

### Voter Token Generation

Tokens can be generated through the admin dashboard or via API:

```bash
curl -X POST https://your-domain.com/api/admin.php/tokens/generate \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d "election_id=1&count=100"
```

## 📖 Usage

### For Voters

#### 1. Access the Voting Page

Navigate to: `https://your-domain.com/vote/`

#### 2. Enter Your Token

- You will receive a unique voting token (e.g., `ABC123-XYZ789`)
- Enter this token in the provided field
- Click "Access Ballot"

#### 3. Cast Your Votes

- Review the election description
- Select your candidates for each position
- Review your selections
- Click "Submit My Votes"

#### 4. Confirm Submission

- Review the confirmation modal
- Click "Confirm & Submit" to finalize
- ⚠️ **Note**: Votes cannot be changed after submission

#### 5. View Results (After Voting Closes)

- Return to the voting page
- Click "View Results" to see election outcomes

### For Administrators

#### 1. Access the Dashboard

Navigate to: `https://your-domain.com/vote/admin/`

#### 2. Authentication

- Enter your admin credentials
- Complete two-factor authentication if enabled

#### 3. Dashboard Overview

The dashboard provides:
- **Live Statistics**: Total votes, participation rate, active voters
- **Recent Activity**: Real-time vote submissions
- **Charts**: Vote distribution and turnout graphs

#### 4. Manage Elections

**Create New Election:**
1. Click "New Election"
2. Fill in election details
3. Add positions and candidates
4. Generate voter tokens
5. Activate when ready

**Monitor Active Election:**
- View real-time vote counts
- Track voter participation
- Monitor for irregularities

**Close Election:**
1. Click "Stop Voting"
2. Confirm closure
3. Results become visible to voters

#### 5. Voter Management

**Generate Tokens:**
```
Dashboard → Voter Management → Generate Tokens
- Specify quantity
- Download token list
- Distribute to eligible voters
```

**Check Token Status:**
```
Dashboard → Voter Management → Search Token
- Enter token to verify status
- View if token has been used
- Check associated vote timestamp
```

#### 6. Export Results

**CSV Export:**
- Includes all positions and candidates
- Vote counts and percentages
- Timestamp of export

**JSON Export:**
- Structured data format
- Suitable for further analysis
- Includes metadata

## 📡 API Documentation

### Authentication

All API requests (except public voting endpoints) require authentication:

```javascript
headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
}
```

### Endpoints

#### Elections

```
GET    /api/elections.php           # List all elections
GET    /api/elections.php/{id}      # Get election details
POST   /api/elections.php           # Create election (admin)
PUT    /api/elections.php/{id}      # Update election (admin)
DELETE /api/elections.php/{id}      # Delete election (admin)
```

#### Votes

```
POST   /api/votes.php               # Submit vote
GET    /api/votes.php/{id}/results  # Get results
GET    /api/votes.php/{id}/verify   # Verify token status
```

#### Admin

```
POST   /api/admin.php/tokens/generate     # Generate tokens
GET    /api/admin.php/stats/{election_id} # Get statistics
GET    /api/admin.php/activity            # Get recent activity
POST   /api/admin.php/export              # Export results
```

### Example Requests

**Submit a Vote:**
```javascript
fetch('https://api.example.com/votes.php', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        token: 'ABC123-XYZ789',
        election_id: 1,
        votes: [
            { position_id: 1, candidate_id: 5 },
            { position_id: 2, candidate_id: 8 }
        ]
    })
});
```

**Get Results:**
```javascript
fetch('https://api.example.com/votes.php/1/results')
    .then(response => response.json())
    .then(data => console.log(data));
```

## 🔐 Security

### Voter Privacy

- **Token-based Authentication**: No personal information collected
- **One-time Use Tokens**: Prevents duplicate voting
- **Anonymous Storage**: Votes stored separately from token validation
- **No Tracking**: No IP logging or browser fingerprinting

### Data Protection

- **HTTPS Required**: All traffic encrypted in transit
- **Prepared Statements**: SQL injection prevention
- **Input Validation**: XSS and CSRF protection
- **Rate Limiting**: Prevents brute force attacks

### Admin Security

- **Role-based Access**: Granular permission system
- **Audit Logging**: All actions tracked
- **Session Management**: Automatic timeout and renewal
- **Two-factor Authentication**: Optional 2FA support

### Best Practices

1. **Use HTTPS**: Always deploy with SSL/TLS
2. **Secure Tokens**: Use cryptographically secure random generation
3. **Regular Backups**: Automated database backups
4. **Update Dependencies**: Keep all software current
5. **Monitor Logs**: Regular security audit reviews

## 💻 Development

### Local Development Setup

```bash
# Start development server
php -S localhost:8000

# Watch CSS changes (if using preprocessor)
npm run watch:css

# Run tests
npm test
```

### Code Structure

**Voter Interface (`site/js/voting.js`):**
- Election state management
- Form validation and submission
- Results visualization
- Error handling

**Admin Dashboard (`admin/js/dashboard.js`):**
- Real-time statistics updates
- Chart rendering with Chart.js
- Token management
- Data export functionality

### Adding New Features

1. **Create feature branch**
   ```bash
   git checkout -b feature/new-feature
   ```

2. **Implement changes**
   - Update API endpoints if needed
   - Modify frontend components
   - Add tests

3. **Test thoroughly**
   - Manual testing across browsers
   - Automated test suite
   - Security review

4. **Submit pull request**

## 🐛 Troubleshooting

### Common Issues

**Issue: "Invalid Token" Error**
- Verify token hasn't been used
- Check token format (must match pattern)
- Ensure election is active

**Issue: Votes Not Submitting**
- Check network connectivity
- Verify API endpoint configuration
- Review browser console for errors
- Ensure all required fields are selected

**Issue: Dashboard Not Loading**
- Clear browser cache
- Check admin authentication
- Verify API permissions
- Review server logs

**Issue: Results Not Displaying**
- Confirm voting period has ended
- Check election status in database
- Verify results calculation cron job

**Issue: Blank page or infinite loading on Cloudflare Pages**
- Open browser DevTools (F12) and check Console tab for errors
- Verify all file paths use relative paths (`./` instead of `/`)
- Check that API_BASE URL is correctly configured
- Ensure CORS is enabled on your API server
- Check Network tab to see if API requests are being blocked
- Try clearing Cloudflare cache: Cloudflare Dashboard → Caching → Purge Everything

**Issue: "Failed to fetch" errors**
- Verify API endpoint is using HTTPS
- Check CORS configuration on API server
- Ensure API is publicly accessible
- Test API endpoint directly in browser

### Debug Mode

Enable debug mode in `voting.js` and `dashboard.js`:

```javascript
const DEBUG = true;
```

### Logs

**Application Logs:**
```bash
tail -f /var/log/apache2/error.log
```

**Database Logs:**
```bash
tail -f /var/log/mysql/error.log
```

## 📊 Performance

### Optimization Tips

- **Enable caching**: Use browser and server-side caching
- **CDN for assets**: Serve static files from CDN
- **Database indexing**: Optimize query performance
- **Lazy loading**: Load results charts on demand
- **Compression**: Enable gzip compression

### Scaling

For large elections (10,000+ voters):
- Use database read replicas
- Implement Redis for session management
- Consider load balancing
- Enable database query caching

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📧 Support

For issues and questions:
- 📖 Check the [Wiki](https://github.com/yourusername/voting-system/wiki)
- 🐛 Report bugs via [Issues](https://github.com/yourusername/voting-system/issues)
- 💬 Join our [Discord](https://discord.gg/voting-system)
- 📧 Email: support@voting-system.example.com

## 🙏 Acknowledgments

- Chart.js for visualization
- Inter font family by Rasmus Andersson
- Icons from Heroicons
- Inspired by modern democratic voting systems

---

**Version**: 1.0.0  
**Last Updated**: 2024  
**Maintained by**: Your Organization Name
