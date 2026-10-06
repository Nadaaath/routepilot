pipeline {
    agent any

    environment {
        CI = 'true'
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Backend') {
            steps {
                dir('backend') {
                    sh 'npm ci'
                    sh 'npm run prisma:validate'
                    sh 'npm run prisma:generate'
                    sh 'npm run build'
                }
            }
        }

        stage('Frontend') {
            steps {
                dir('frontend') {
                    sh 'npm ci'
                    sh 'npm run build'
                }
            }
        }

        stage('Docker Build') {
            steps {
                sh 'docker build -t routepilot-backend:${BUILD_NUMBER} ./backend'
                sh 'docker build --build-arg VITE_API_BASE_URL=/api -t routepilot-frontend:${BUILD_NUMBER} ./frontend'
            }
        }
    }

    post {
        success {
            echo 'RoutePilot CI completed successfully.'
        }

        failure {
            echo 'RoutePilot CI failed.'
        }
    }
}