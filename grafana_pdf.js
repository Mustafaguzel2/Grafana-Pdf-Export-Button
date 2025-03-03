'use strict';

const puppeteer = require('puppeteer');
const fetch = require('node-fetch');
const fs = require('fs');

console.log("Script grafana_pdf.js started...");

const url = process.argv[2];
const auth_string = process.argv[3];
const options = JSON.parse(process.argv[4] || '{}');

// Get options from environment or use improved defaults
const width_px = parseInt(process.env.PDF_WIDTH_PX, 10) || 2400;
const deviceScaleFactor = parseFloat(process.env.DEVICE_SCALE_FACTOR) || 2.0;
const renderTimeout = parseInt(process.env.RENDER_TIMEOUT, 10) || 30000;
const navigationTimeout = parseInt(process.env.PUPPETEER_NAVIGATION_TIMEOUT, 10) || 120000;

console.log("PDF width set to:", width_px);
console.log("Device scale factor:", deviceScaleFactor);

const auth_header = 'Basic ' + Buffer.from(auth_string).toString('base64');

(async () => {
    try {
        console.log("URL provided:", url);
        console.log("Checking URL accessibility...");
        const response = await fetch(url, {
            method: 'GET',
            headers: {'Authorization': auth_header}
        });

        if (!response.ok) {
            throw new Error(`Unable to access URL. HTTP status: ${response.status}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('text/html')) {
            throw new Error("The URL provided is not a valid Grafana instance.");
        }

        let finalUrl = url;
        // Always enable kiosk mode for better rendering
        if (!finalUrl.includes('kiosk')) {
            finalUrl += (finalUrl.includes('?') ? '&' : '?') + 'kiosk=tv';
        }

        // Check if this is a single panel view
        const isSinglePanel = finalUrl.includes('viewPanel=') || finalUrl.includes('panelId=');

        console.log("Starting browser...");
        const browser = await puppeteer.launch({
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu',
                '--font-render-hinting=none',
                '--disable-font-subpixel-positioning',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--window-size=2400,1600'
            ]
        });

        const page = await browser.newPage();
        console.log("Browser started...");

        // Set better quality settings
        await page.setExtraHTTPHeaders({'Authorization': auth_header});
        await page.setDefaultNavigationTimeout(navigationTimeout);

        // Initial viewport setup
        await page.setViewport({
            width: width_px,
            height: 1600,
            deviceScaleFactor: deviceScaleFactor,
            isMobile: false
        });

        // Inject custom styles for better PDF rendering
        await page.addStyleTag({
            content: `
                /* Hide unnecessary elements */
                .sidemenu, .navbar-page-btn, .navbar, .dashboard-header, .submenu-controls { 
                    display: none !important; 
                }
                
                /* Optimize panel layout */
                .react-grid-layout {
                    width: 100% !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    transform: none !important;
                }
                
                /* Improve panel visibility */
                .panel-container {
                    border: none !important;
                    box-shadow: none !important;
                    background: transparent !important;
                    margin: 0 !important;
                    width: 100% !important;
                }
                
                /* Remove scrollbars */
                ::-webkit-scrollbar { display: none !important; }
                * { scrollbar-width: none !important; }
                
                /* Optimize for printing */
                @page { margin: 0; }
                
                /* Make content full width */
                .main-view, .scroll-canvas, .dashboard-container {
                    width: 100% !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    transform: none !important;
                }
                
                /* Improve graph readability */
                .graph-panel__chart, .panel-content {
                    overflow: visible !important;
                    width: 100% !important;
                }
                
                /* Ensure text is readable */
                text { font-weight: 500 !important; }
                
                /* Remove panel padding */
                .panel-content { 
                    padding: 0 !important;
                    height: auto !important;
                }
                
                /* Ensure proper graph sizing */
                .graph-panel { 
                    height: 100% !important;
                    width: 100% !important;
                }

                /* Reset grid item positioning */
                .react-grid-item {
                    position: relative !important;
                    transform: none !important;
                    margin: 0 !important;
                    width: 100% !important;
                }

                /* Hide unnecessary elements */
                .panel-info-corner,
                .panel-info-corner--info,
                .panel-info-corner--links,
                .react-resizable-handle,
                .panel-header:hover .panel-info-corner,
                .panel-info-corner--info:hover,
                .panel-info-corner--links:hover {
                    display: none !important;
                    opacity: 0 !important;
                    visibility: hidden !important;
                }
            `
        });

        console.log("Navigating to URL...");
        await page.goto(finalUrl, {
            waitUntil: ['networkidle0', 'domcontentloaded', 'load'],
            timeout: navigationTimeout
        });
        console.log("Page loaded...");

        // Wait for visualizations to render
        await page.waitForTimeout(renderTimeout);

        // Additional wait for specific elements
        try {
            await page.waitForSelector('.panel-container', { timeout: 5000 });
        } catch (e) {
            console.log('Panel container not found, continuing...');
        }

        // Calculate the total height of the content
        const dimensions = await page.evaluate((isSinglePanel) => {
            let content;
            const selectors = isSinglePanel ? [
                '.panel-container',
                '.react-grid-item',
                '.dashboard-container',
                '.panel-content',
                '.grafana-panel'
            ] : [
                '.react-grid-layout',
                '.dashboard-container',
                '.dashboard-page',
                '.dashboard-scroll'
            ];

            for (const selector of selectors) {
                content = document.querySelector(selector);
                if (content && content.offsetHeight > 0) break;
            }
            
            if (!content) {
                // Fallback to body if no specific container found
                content = document.body;
            }
            
            // Get the actual content dimensions
            const rect = content.getBoundingClientRect();
            
            // Ensure minimum dimensions
            return {
                width: Math.max(Math.ceil(rect.width), 800),
                height: Math.max(Math.ceil(rect.height), 600)
            };
        }, isSinglePanel);

        // Adjust viewport to match content
        await page.setViewport({
            width: isSinglePanel ? dimensions.width : width_px,
            height: dimensions.height,
            deviceScaleFactor: deviceScaleFactor,
            isMobile: false
        });

        // Wait for the new viewport to settle
        await page.waitForTimeout(1000);

        // Generate filename
        const dashboardName = await page.evaluate(() => {
            const selectors = [
                '.dashboard-title',
                '.panel-title',
                'h1',
                '.page-toolbar h1',
                '.page-header h1'
            ];
            
            for (const selector of selectors) {
                const element = document.querySelector(selector);
                if (element && element.textContent.trim()) {
                    return element.textContent.trim();
                }
            }
            
            return 'dashboard';
        });
        
        const date = new Date().toISOString().split('T')[0];
        const outfile = `./output/${dashboardName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${date}.pdf`;

        console.log("Generating PDF...");
        await page.pdf({
            path: outfile,
            width: isSinglePanel ? dimensions.width + 'px' : width_px + 'px',
            height: dimensions.height + 'px',
            printBackground: true,
            scale: 1,
            displayHeaderFooter: false,
            margin: {top: 0, right: 0, bottom: 0, left: 0},
            preferCSSPageSize: true
        });
        console.log(`PDF generated: ${outfile}`);

        await browser.close();
        console.log("Browser closed.");
        
        process.send({ success: true, path: outfile });
    } catch (error) {
        console.error('Error:', error);
        process.send({ success: false, error: error.message });
        process.exit(1);
    }
})();
