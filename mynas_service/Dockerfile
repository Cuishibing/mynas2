FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

# 执行npm install
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "index.js"] 