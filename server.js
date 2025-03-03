require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { fork } = require('child_process');
const fs = require('fs');

const GRAFANA_USER = process.env.GRAFANA_USER;
const GRAFANA_PASSWORD = process.env.GRAFANA_PASSWORD;
const GRAFANA_HOST = process.env.GRAFANA_HOST || 'host.docker.internal'; // Default Docker host

const app = express();
const port = process.env.EXPORT_SERVER_PORT || 3001;

if (!GRAFANA_USER || !GRAFANA_PASSWORD) {
    console.error('.env file do not seems to be found or missing required fields. Please check README.md for more information. ');
    process.exit(1);
}

app.use(express.json());
app.use(cors());
app.use('/output', express.static(path.join(__dirname, 'output')));

app.get('/check-status', (req, res) => {
    res.send('Server is running');
});

app.post('/generate-pdf', (req, res) => {
    let { 
        url: requestUrl, 
        from, 
        to,
        pdfOptions = {},
        contentType = 'dashboard',
        highQuality = true,
        singlePage = true,
        cssInject = ''
    } = req.body;

    if (!requestUrl) {
        return res.status(400).send('URL is required');
    }

    let responseHandled = false;

    try {
        const urlObj = new URL(requestUrl);
        
        // Replace localhost/127.0.0.1 with Docker host
        if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
            urlObj.hostname = GRAFANA_HOST;
        }

        // Add time range parameters if provided
        if (from && !urlObj.searchParams.has('from')) {
            urlObj.searchParams.append('from', from);
        }
        if (to && !urlObj.searchParams.has('to')) {
            urlObj.searchParams.append('to', to);
        }

        // Set environment variables for the PDF generation process
        process.env.PDF_WIDTH_PX = contentType === 'panel' ? '1200' : '2400';
        process.env.DEVICE_SCALE_FACTOR = highQuality ? '2.0' : '1.0';
        process.env.RENDER_TIMEOUT = '30000';
        process.env.FORCE_KIOSK_MODE = 'true';

        if (singlePage) {
            process.env.PDF_WIDTH_PX = '3000';
            process.env.DEVICE_SCALE_FACTOR = '1.5';
        }

        const finalUrl = urlObj.toString();
        console.log('Generating PDF for URL:', finalUrl);

        const script = fork('grafana_pdf.js', [
            finalUrl,
            `${GRAFANA_USER}:${GRAFANA_PASSWORD}`,
            JSON.stringify({
                pdfOptions,
                contentType,
                highQuality,
                singlePage,
                cssInject
            })
        ]);

        let timeout = setTimeout(() => {
            if (!responseHandled) {
                responseHandled = true;
                script.kill();
                res.status(500).send('PDF generation timeout');
            }
        }, 300000); // 5 minutes timeout

        script.on('message', (message) => {
            clearTimeout(timeout);
            if (!responseHandled) {
                responseHandled = true;
                if (message.success) {
                    const pdfPath = message.path;
                    const pdfUrl = `${req.protocol}://${req.get('host')}/output/${path.basename(pdfPath)}`;
                    res.json({ pdfUrl });
                } else {
                    res.status(500).send(`Error generating PDF: ${message.error}`);
                }
            }
        });

        script.on('error', (error) => {
            clearTimeout(timeout);
            if (!responseHandled) {
                responseHandled = true;
                res.status(500).send(`Error generating PDF: ${error.message}`);
            }
        });

        script.on('exit', (code) => {
            clearTimeout(timeout);
            if (!responseHandled && code !== 0) {
                responseHandled = true;
                res.status(500).send('PDF generation process exited with error');
            }
        });
    } catch (error) {
        if (!responseHandled) {
            responseHandled = true;
            console.error('Error in generate-pdf endpoint:', error);
            res.status(500).send(`Error generating PDF: ${error.message}`);
        }
    }
});

// Clean up old PDFs periodically
setInterval(() => {
    const outputDir = path.join(__dirname, 'output');
    const now = Date.now();
    fs.readdir(outputDir, (err, files) => {
        if (err) {
            console.error('Error reading output directory:', err);
            return;
        }
        files.forEach(file => {
            const filePath = path.join(outputDir, file);
            fs.stat(filePath, (err, stats) => {
                if (err) {
                    console.error('Error getting file stats:', err);
                    return;
                }
                // Remove files older than 1 hour
                if (now - stats.mtime.getTime() > 3600000) {
                    fs.unlink(filePath, err => {
                        if (err) console.error('Error deleting old file:', err);
                    });
                }
            });
        });
    });
}, 3600000); // Run every hour

app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});
