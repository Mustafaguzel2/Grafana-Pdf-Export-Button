# Grafana Dashboard PDF Export Tool

A powerful and efficient tool for exporting Grafana dashboards to high-quality PDF files. This tool supports both full dashboard and single panel exports with optimized rendering and automatic cleanup capabilities.

## 🌟 Features

- **High-Quality PDF Export**: Generates high-resolution PDFs with configurable width and scale factor
- **Smart Content Detection**: Automatically detects and exports dashboard content with proper dimensions
- **Flexible Export Options**: Supports both full dashboard and single panel exports
- **Automatic Cleanup**: Includes a scheduled cleanup system for managing generated PDFs
- **Resource Optimization**: Configurable viewport settings and rendering parameters
- **Error Handling**: Robust error handling and reporting system

## 🚀 Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd grafana-export-to-pdf
```

2. Install dependencies:
```bash
npm install
```

3. Install PM2 globally (for cleanup service):
```bash
npm install -g pm2
```

## ⚙️ Configuration

### PDF Export Settings
You can configure the following environment variables:

```bash
PDF_WIDTH_PX=2400           # Default PDF width in pixels
DEVICE_SCALE_FACTOR=2.0     # Device scale factor for rendering
RENDER_TIMEOUT=30000        # Timeout for rendering (in milliseconds)
PUPPETEER_NAVIGATION_TIMEOUT=120000  # Navigation timeout
```

### Cleanup Service Settings
Edit `cleanup.js` to modify:
- `MAX_AGE_HOURS`: Duration to keep PDFs (default: 72 hours)
- `OUTPUT_DIR`: Directory for PDF storage (default: './output')

Edit `cleanup-cron.js` to modify the cleanup schedule (default: daily at midnight).

## 🔧 Usage

### Starting the PDF Export Service

```bash
node grafana_pdf.js [dashboard-url] [auth-string] [options]
```

Example:
```bash
node grafana_pdf.js "http://grafana/d/dashboard" "admin:password" '{"kiosk":true}'
```

### Starting the Cleanup Service

```bash
# Start the cleanup service with PM2
pm2 start cleanup-cron.js --name "pdf-cleanup"

# Monitor the service
pm2 status
pm2 logs pdf-cleanup
```

### Managing the Cleanup Service

```bash
# Stop the service
pm2 stop pdf-cleanup

# Restart the service
pm2 restart pdf-cleanup

# View logs
pm2 logs pdf-cleanup
```

## 📊 Output

Generated PDFs will be stored in the `output` directory with the following naming convention:
```
[dashboard_name]_[date].pdf
```

## 🔍 Monitoring and Maintenance

The cleanup service automatically removes PDF files older than the configured retention period (default: 72 hours). You can monitor the cleanup process through PM2 logs:

```bash
pm2 logs pdf-cleanup
```

## 🛠 Technical Details

### PDF Generation Process
1. Launches a headless Chrome instance via Puppeteer
2. Configures viewport and rendering settings
3. Navigates to the dashboard URL
4. Waits for content to load and render
5. Captures the content and generates PDF
6. Applies optimization and quality enhancements

### Cleanup Process
- Runs on a scheduled basis (default: daily at midnight)
- Scans the output directory for old PDF files
- Removes files exceeding the age threshold
- Logs deletion statistics and any errors

## ⚠️ Requirements

- Node.js (v14 or higher)
- PM2 (for cleanup service)
- Sufficient system resources:
  - Minimum 2GB RAM
  - 2 CPU cores
  - 10GB disk space

## 🔐 Security Notes

This tool assumes:
- VPN access control
- Authentication system in place
- Secure server environment
- Limited server access

## 📝 Logging

The system provides detailed logging for both PDF generation and cleanup processes:
- PDF generation status and errors
- Cleanup operation statistics
- System resource usage
- Error tracking and reporting

## 🌐 Deployment & Customization

### Server Configuration

You can deploy this tool on different servers with custom configurations. Here's how to set it up:

1. **Environment Setup**:
   Create a `.env` file in your project root:
   ```bash
   # Server Configuration
   SERVER_PORT=3000                  # Port for the service
   SERVER_HOST=0.0.0.0              # Host address (0.0.0.0 for all interfaces)
   
   # PDF Export Configuration
   PDF_OUTPUT_DIR=/path/to/output   # Custom output directory
   PDF_WIDTH_PX=2400                # PDF width in pixels
   DEVICE_SCALE_FACTOR=2.0          # Screen scale factor
   
   # Timeouts
   RENDER_TIMEOUT=30000             # Rendering timeout (ms)
   NAVIGATION_TIMEOUT=120000        # Page navigation timeout (ms)
   
   # Cleanup Configuration
   CLEANUP_SCHEDULE="0 0 * * *"     # Cron schedule for cleanup
   MAX_AGE_HOURS=72                 # File retention period
   ```

2. **Custom Output Directory**:
   You can specify a custom output directory in three ways:
   
   a. Using environment variable:
   ```bash
   export PDF_OUTPUT_DIR=/custom/path/to/output
   ```
   
   b. In your `.env` file:
   ```bash
   PDF_OUTPUT_DIR=/custom/path/to/output
   ```
   
   c. Modifying `cleanup.js`:
   ```javascript
   const OUTPUT_DIR = process.env.PDF_OUTPUT_DIR || '/custom/path/to/output';
   ```

3. **Directory Permissions**:
   ```bash
   # Create output directory if it doesn't exist
   mkdir -p /custom/path/to/output
   
   # Set proper permissions
   chmod 755 /custom/path/to/output
   
   # If running as different user
   chown -R user:group /custom/path/to/output
   ```

### Multi-Server Setup

For running the service on multiple servers:

1. **Different Output Directories**:
   ```bash
   # Server 1
   PDF_OUTPUT_DIR=/mnt/server1/pdf_output
   
   # Server 2
   PDF_OUTPUT_DIR=/mnt/server2/pdf_output
   ```

2. **Shared Storage Option**:
   You can use a shared network storage:
   ```bash
   # Mount shared storage
   mount -t nfs nfs-server:/shared/pdf_output /mnt/pdf_output
   
   # Update environment
   PDF_OUTPUT_DIR=/mnt/pdf_output
   ```

3. **Load Balancer Configuration**:
   If using multiple servers behind a load balancer:
   ```nginx
   # Example Nginx configuration
   upstream pdf_export {
       server server1:3000;
       server server2:3000;
   }
   
   server {
       listen 80;
       server_name pdf-export.yourdomain.com;
       
       location / {
           proxy_pass http://pdf_export;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

### Monitoring Multiple Instances

For monitoring multiple instances:

1. **PM2 Monitoring**:
   ```bash
   # Start service with unique names
   pm2 start cleanup-cron.js --name "pdf-cleanup-server1"
   pm2 start cleanup-cron.js --name "pdf-cleanup-server2"
   
   # Monitor all instances
   pm2 monitor
   ```

2. **Log Management**:
   ```bash
   # Configure separate log directories
   SERVER1_LOG_DIR=/var/log/pdf-export/server1
   SERVER2_LOG_DIR=/var/log/pdf-export/server2
   ```

### Health Checks

Add health check endpoints to monitor service status:

```bash
curl http://your-server:3000/health
```

Response example:
```json
{
    "status": "healthy",
    "outputDir": "/custom/path/to/output",
    "diskSpace": {
        "free": "50GB",
        "total": "100GB"
    },
    "lastCleanup": "2024-03-20T00:00:00Z"
}
```

## 🤝 Contributing

Feel free to submit issues and enhancement requests!