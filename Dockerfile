FROM node:18

# Install yt-dlp and ffmpeg
RUN apt-get update && apt-get install -y ffmpeg curl && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod +x /usr/local/bin/yt-dlp

# Set working directory
WORKDIR /app

# Copy app files
COPY package*.json ./
RUN npm install
COPY . .

# Expose port
EXPOSE 3000

# Start the app
CMD ["npm", "start"]
