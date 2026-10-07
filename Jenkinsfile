pipeline {
    agent any

    options {
        skipDefaultCheckout(true)
        disableConcurrentBuilds()
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    parameters {
    string(
        name: 'ROLLBACK_TAG',
        defaultValue: '',
        description: 'Optional previous Git SHA to redeploy. Leave empty for a normal release.'
    )
}

    environment {
        CI = 'true'

        // CI-only database URL used by Prisma validation/generation.
        // This is NOT the HCS production database.
        DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/routepilot_ci?schema=public'
    }

    stages {

        // ====================================================
        // SOURCE CODE
        // ====================================================

        stage('Checkout') {
    steps {
        checkout scm

        script {
            def currentTag = sh(
                script: 'git rev-parse --short=7 HEAD',
                returnStdout: true
            ).trim()

            def rollbackTag = params.ROLLBACK_TAG?.trim()

            if (rollbackTag) {

                if (!(rollbackTag ==~ /^[0-9a-fA-F]{7,40}$/)) {
                    error('ROLLBACK_TAG must be a valid Git SHA.')
                }

                env.ROUTEPILOT_IMAGE_TAG = rollbackTag.toLowerCase()
                env.ROUTEPILOT_DEPLOY_MODE = 'ROLLBACK'

            } else {

                env.ROUTEPILOT_IMAGE_TAG = currentTag
                env.ROUTEPILOT_DEPLOY_MODE = 'RELEASE'
            }

            echo "Deployment mode: ${env.ROUTEPILOT_DEPLOY_MODE}"
            echo "Image tag: ${env.ROUTEPILOT_IMAGE_TAG}"
        }
    }
}


        // ====================================================
        // BACKEND CI
        // ====================================================

        stage('Backend') {
            when {
    expression {
        return env.ROUTEPILOT_DEPLOY_MODE == 'RELEASE'
    }
}
            steps {
                dir('backend') {
                    sh 'npm ci'
                    sh 'npm run prisma:validate'
                    sh 'npm run prisma:generate'
                    sh 'npm run build'
                }
            }
        }


        // ====================================================
        // FRONTEND CI
        // ====================================================

        stage('Frontend') {
            when {
    expression {
        return env.ROUTEPILOT_DEPLOY_MODE == 'RELEASE'
    }
}
            steps {
                dir('frontend') {
                    sh 'npm ci'
                    sh 'npm run build'
                }
            }
        }


        // ====================================================
        // BUILD + PUBLISH IMMUTABLE DOCKER ARTIFACTS
        // ====================================================

        stage('Build and Publish Images') {
            when {
    expression {
        return env.ROUTEPILOT_DEPLOY_MODE == 'RELEASE'
    }
}
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'ghcr-credentials',
                        usernameVariable: 'GHCR_USER',
                        passwordVariable: 'GHCR_TOKEN'
                    )
                ]) {
                    sh '''
                        set -e

                        echo "Building RoutePilot images:"
                        echo "  Backend : ghcr.io/nadaaath/routepilot-backend:$ROUTEPILOT_IMAGE_TAG"
                        echo "  Frontend: ghcr.io/nadaaath/routepilot-frontend:$ROUTEPILOT_IMAGE_TAG"

                        docker build \
                          -t ghcr.io/nadaaath/routepilot-backend:$ROUTEPILOT_IMAGE_TAG \
                          ./backend

                        docker build \
                          --build-arg VITE_API_BASE_URL=/api \
                          -t ghcr.io/nadaaath/routepilot-frontend:$ROUTEPILOT_IMAGE_TAG \
                          ./frontend

                        set +x

                        printf '%s' "$GHCR_TOKEN" | \
                            docker login ghcr.io \
                            -u "$GHCR_USER" \
                            --password-stdin

                        trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT

                        docker push \
                          ghcr.io/nadaaath/routepilot-backend:$ROUTEPILOT_IMAGE_TAG

                        docker push \
                          ghcr.io/nadaaath/routepilot-frontend:$ROUTEPILOT_IMAGE_TAG
                    '''
                }
            }
        }

        stage('Verify Rollback Images') {

    when {
        expression {
            return env.ROUTEPILOT_DEPLOY_MODE == 'ROLLBACK'
        }
    }

    steps {
        withCredentials([
            usernamePassword(
                credentialsId: 'ghcr-credentials',
                usernameVariable: 'GHCR_USER',
                passwordVariable: 'GHCR_TOKEN'
            )
        ]) {
            sh '''
                set -e
                set +x

                printf '%s' "$GHCR_TOKEN" | \
                    docker login ghcr.io \
                    -u "$GHCR_USER" \
                    --password-stdin

                trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT

                echo "Checking rollback images for $ROUTEPILOT_IMAGE_TAG"

                docker pull \
                  ghcr.io/nadaaath/routepilot-backend:$ROUTEPILOT_IMAGE_TAG

                docker pull \
                  ghcr.io/nadaaath/routepilot-frontend:$ROUTEPILOT_IMAGE_TAG
            '''
        }
    }
}


        // ====================================================
        // VERIFY PRIVATE HCS MANAGEMENT PATH
        // ====================================================

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

                            trap 'rm -f "$VAULT_FILE"' EXIT

                            printf '%s' "$ROUTEPILOT_VAULT_PASSWORD" \
                              > "$VAULT_FILE"

                            ansible all \
                              -m ping \
                              -u "$ROUTEPILOT_SSH_USER" \
                              --private-key "$ROUTEPILOT_SSH_KEY" \
                              --vault-password-file "$VAULT_FILE"
                        '''
                    }
                }
            }
        }


        // ====================================================
        // DEPLOY EXACT JENKINS-BUILT IMAGES
        // ====================================================

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
                        ),
                        usernamePassword(
                            credentialsId: 'ghcr-credentials',
                            usernameVariable: 'GHCR_USER',
                            passwordVariable: 'GHCR_TOKEN'
                        )
                    ]) {
                        sh '''
                            set +x

                            VAULT_FILE="$(mktemp)"
                            chmod 600 "$VAULT_FILE"

                            trap 'rm -f "$VAULT_FILE"' EXIT

                            printf '%s' "$ROUTEPILOT_VAULT_PASSWORD" \
                              > "$VAULT_FILE"

                            ansible-playbook \
                              playbooks/deploy.yml \
                              -u "$ROUTEPILOT_SSH_USER" \
                              --private-key "$ROUTEPILOT_SSH_KEY" \
                              --vault-password-file "$VAULT_FILE"
                        '''
                    }
                }
            }
        }


        // ====================================================
        // POST-DEPLOYMENT HEALTH CHECKS
        // ====================================================

        stage('Health Checks') {
            steps {
                withCredentials([
                    sshUserPrivateKey(
                        credentialsId: 'routepilot-jenkins-ssh',
                        keyFileVariable: 'ROUTEPILOT_SSH_KEY',
                        usernameVariable: 'ROUTEPILOT_SSH_USER'
                    )
                ]) {
                    sh '''
                        set -e

                        echo "Checking frontend container..."

                        ssh \
                          -i "$ROUTEPILOT_SSH_KEY" \
                          -o BatchMode=yes \
                          "$ROUTEPILOT_SSH_USER@10.100.1.10" \
                          "curl -fsS --max-time 10 http://127.0.0.1/ > /dev/null"

                        echo "Frontend OK"

                        echo "Checking backend container..."

                        ssh \
                          -i "$ROUTEPILOT_SSH_KEY" \
                          -o BatchMode=yes \
                          "$ROUTEPILOT_SSH_USER@10.100.2.10" \
                          "curl -fsS --max-time 10 http://127.0.0.1:8000/ > /dev/null"

                        echo "Backend OK"
                    '''
                }
            }
        }
    }


    // ========================================================
    // PIPELINE RESULT
    // ========================================================

    post {

        success {
            echo "RoutePilot CI/CD succeeded."
            echo "Deployed image tag: ${env.ROUTEPILOT_IMAGE_TAG}"
        }

        failure {
            echo "RoutePilot CI/CD failed."
        }

        always {
            sh 'rm -f /tmp/routepilot-vault-* 2>/dev/null || true'
        }
    }
}