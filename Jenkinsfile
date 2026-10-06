pipeline {
    agent any

    options {
        skipDefaultCheckout(true)
    }

    environment {
        CI = 'true'

        // CI-only Prisma configuration.
        // NOT the HCS production database.
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

        stage('Ansible Preflight') {
            steps {
                dir('infrastructure/ansible') {

                    withCredentials([
                        sshUserPrivateKey(
                            credentialsId: 'routepilot-jenkins-ssh',
                            keyFileVariable: 'ROUTEPILOT_SSH_KEY',
                            usernameVariable: 'ROUTEPILOT_SSH_USER'
                        ),
                        string(
                            credentialsId: 'routepilot-vault-password',
                            variable: 'ROUTEPILOT_VAULT_PASSWORD'
                        )
                    ]) {
                        sh '''
                            set +x

                            VAULT_FILE="$(mktemp)"
                            chmod 600 "$VAULT_FILE"

                            printf '%s' "$ROUTEPILOT_VAULT_PASSWORD" > "$VAULT_FILE"

                            ansible all \
                              -m ping \
                              -u "$ROUTEPILOT_SSH_USER" \
                              --private-key "$ROUTEPILOT_SSH_KEY" \
                              --vault-password-file "$VAULT_FILE"

                            rm -f "$VAULT_FILE"
                        '''
                    }
                }
            }
        }

        stage('Deploy to HCS') {
            steps {
                dir('infrastructure/ansible') {

                    withCredentials([
                        sshUserPrivateKey(
                            credentialsId: 'routepilot-jenkins-ssh',
                            keyFileVariable: 'ROUTEPILOT_SSH_KEY',
                            usernameVariable: 'ROUTEPILOT_SSH_USER'
                        ),
                        string(
                            credentialsId: 'routepilot-vault-password',
                            variable: 'ROUTEPILOT_VAULT_PASSWORD'
                        )
                    ]) {
                        sh '''
                            set +x

                            VAULT_FILE="$(mktemp)"
                            chmod 600 "$VAULT_FILE"

                            printf '%s' "$ROUTEPILOT_VAULT_PASSWORD" > "$VAULT_FILE"

                            ansible-playbook \
                              playbooks/deploy.yml \
                              -u "$ROUTEPILOT_SSH_USER" \
                              --private-key "$ROUTEPILOT_SSH_KEY" \
                              --vault-password-file "$VAULT_FILE"

                            rm -f "$VAULT_FILE"
                        '''
                    }
                }
            }
        }

        stage('Frontend Health Check') {
            steps {
                dir('infrastructure/ansible') {

                    withCredentials([
                        sshUserPrivateKey(
                            credentialsId: 'routepilot-jenkins-ssh',
                            keyFileVariable: 'ROUTEPILOT_SSH_KEY',
                            usernameVariable: 'ROUTEPILOT_SSH_USER'
                        )
                    ]) {
                        sh '''
                            ansible frontend \
                              -m uri \
                              -a "url=http://127.0.0.1/ status_code=200" \
                              -u "$ROUTEPILOT_SSH_USER" \
                              --private-key "$ROUTEPILOT_SSH_KEY"
                        '''
                    }
                }
            }
        }
    }

    post {
        success {
            echo "RoutePilot CI/CD succeeded - build ${BUILD_NUMBER}"
        }

        failure {
            echo "RoutePilot CI/CD failed - production deployment may not have completed."
        }

        always {
            sh 'rm -f /tmp/routepilot-vault-* 2>/dev/null || true'
        }
    }
}