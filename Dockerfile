# Use Puppeteer's official Docker image with Chromium pre-installed
FROM ghcr.io/puppeteer/puppeteer:21.6.1

# Set environment variables to skip Chromium download and use the bundled version
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    NODE_ENV=production

# Set working directory
WORKDIR /usr/src/app

# Switch to root for installation
USER root
# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci
# Copy application files
COPY . .

# Build the application for production
RUN npm run build




# Expose port
EXPOSE 5000

# Switch back to pptruser for runtime
USER pptruser
# Start the application
CMD ["npm", "start"]
