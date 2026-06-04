FROM node:18-alpine

# Set working directory inside the container
WORKDIR /app

# Copy backend package files first to leverage Docker layer caching
COPY backend/package*.json ./backend/

# Install dependencies inside the backend folder
RUN cd backend && npm install --omit=dev

# Copy all application files to the container
COPY . .

# Set environment variables
ENV NODE_ENV=production

# Start Express server
CMD ["node", "backend/server.js"]
