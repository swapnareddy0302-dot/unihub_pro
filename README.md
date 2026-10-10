
# UniHub — Campus Connect

A responsive campus portal built with HTML, CSS, JavaScript,
Firebase Authentication and Cloud Firestore.

## Features

- Student registration and login
- Student dashboard and profile
- Campus request submission and status tracking
- Classroom issues and Lost & Found request categories
- Attendance overview
- Event idea submissions
- Campus announcements
- Student resource links
- Admin request management
- Responsive dark-themed UI

## Run using VS Code

1. Open the UniHub folder in VS Code.
2. Install the Live Server extension.
3. Right-click index.html.
4. Select Open with Live Server.
5. The app opens in your browser.

Do not open index.html directly from File Explorer. The JavaScript
uses browser modules and should be served over localhost.

## Firebase setup

1. Create a project at https://console.firebase.google.com/
2. Register a Web App in Project settings.
3. Copy the Firebase web configuration into firebase-config.js.
4. Enable Authentication > Sign-in method > Email/Password.
5. Create a Cloud Firestore database.
6. Open Firestore > Rules.
7. Paste firestore.rules and publish the rules.
8. Reload the site and create an account.

New accounts receive the student role.

## Grant admin access

1. Register the account that should become the administrator.
2. Open Firebase Console > Firestore Database > users.
3. Open the document whose ID matches that user's Firebase Auth UID.
4. Change its role field from student to admin.
5. Sign out and sign in again.

Only grant this role to a trusted account.

## Demo mode

Without Firebase configuration, the interface uses browser localStorage.
Demo data is not shared between devices and is not stored in Firestore.

The dashboard's default 85% attendance figure is a demo placeholder.
Replace it with actual attendance records before presenting real results.

## Security

Never place Firebase service-account private keys in frontend code.
Use Firebase Authentication and Firestore Security Rules to control access.
Replace example.com resource URLs with official college links.
