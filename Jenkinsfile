pipeline {
    agent any

    options {
        // Pipeline from SCM already performs an automatic checkout.
        // We want to manage checkout ourselves below.
        skipDefaultCheckout(true)
    }

    environment {
        CI = 'true'

        // CI-only Prisma configuration.
        // This is NOT the HCS production database.
        DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/routepilot_ci?schema=public'
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
                sh '''
                    docker build \
                      -t routepilot-backend:${BUILD_NUMBER} \
                      ./backend
                '''

                sh '''
                    docker build \
                      --build-arg VITE_API_BASE_URL=/api \
                      -t routepilot-frontend:${BUILD_NUMBER} \
                      ./frontend
                '''
            }
        }
    }

    post {
        success {
            echo "RoutePilot CI succeeded - build ${BUILD_NUMBER}"
        }

        failure {
            echo "RoutePilot CI failed."
        }
    }
}