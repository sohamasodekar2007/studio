<?php
session_start();
// Conceptual PHP script for login.
// IMPORTANT: For a real application, this needs:
// 1. Secure password hashing (e.g., password_hash() for signup, password_verify() here).
// 2. Robust input validation and sanitization.
// 3. CSRF protection.
// 4. Proper error handling and logging.

$error_message = '';
$users_file_path = __DIR__ . '/../data/users.json'; // Path to your users.json

if (isset($_GET['error']) && $_GET['error'] === 'unauthorized') {
    $error_message = 'You are not authorized to access that page. Please log in.';
}
if (isset($_GET['logout'])) {
    $error_message = 'You have been successfully logged out.'; // Using error_message for simplicity
}


if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = trim(filter_var($_POST['email'] ?? '', FILTER_SANITIZE_EMAIL));
    $password_attempt = $_POST['password'] ?? '';

    if (empty($email) || empty($password_attempt)) {
        $error_message = 'Email and password are required.';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $error_message = 'Invalid email format.';
    } else {
        if (file_exists($users_file_path)) {
            $users_data_json = file_get_contents($users_file_path);
            $users_array = json_decode($users_data_json, true);

            if (is_array($users_array)) {
                $found_user = null;
                foreach ($users_array as $user_record) {
                    if (isset($user_record['email']) && strtolower($user_record['email']) === strtolower($email)) {
                        $found_user = $user_record;
                        break;
                    }
                }

                if ($found_user && isset($found_user['password'])) {
                    // Verify the password
                    // For production, passwords MUST be stored hashed. Example:
                    // if (password_verify($password_attempt, $found_user['password'])) {
                    if ($password_attempt === $found_user['password']) { // Placeholder - REPLACE with password_verify
                        $_SESSION['user_email'] = $found_user['email'];
                        $_SESSION['user_id'] = $found_user['id'];
                        $_SESSION['user_role'] = $found_user['role'] ?? 'User';
                        $_SESSION['user_name'] = $found_user['name'] ?? $found_user['email'];
                        $_SESSION['user_model'] = $found_user['model'] ?? 'free';


                        if ($_SESSION['user_role'] === 'Admin') {
                            header('Location: ../admin/dashboard.php');
                        } else {
                            header('Location: ../index.html'); // Or a user-specific dashboard
                        }
                        exit;
                    } else {
                        $error_message = 'Invalid email or password.';
                    }
                } else {
                    $error_message = 'Invalid email or password.';
                }
            } else {
                $error_message = 'User data store is corrupted or empty.';
            }
        } else {
            // Create a default admin if users.json doesn't exist (for first run)
            $default_admin_email = getenv('NEXT_PUBLIC_ADMIN_EMAIL') ?: 'admin@edunexus.com';
            $default_admin_password_plain = getenv('ADMIN_PASSWORD') ?: 'Soham@1234';
            // $default_admin_password_hashed = password_hash($default_admin_password_plain, PASSWORD_DEFAULT); // HASH THIS
            
            // IMPORTANT: Store HASHED password in users.json. This is a placeholder.
            $default_admin_password_stored = $default_admin_password_plain; 


            $default_users = [
                [
                    "id" => "admin-uuid-placeholder-" . uniqid(),
                    "email" => $default_admin_email,
                    "password" => $default_admin_password_stored, // Store HASHED password
                    "name" => "Admin User (Primary)",
                    "phone" => "0000000000",
                    "class" => "Dropper",
                    "model" => "combo",
                    "role" => "Admin",
                    "expiry_date" => "2099-12-31T00:00:00.000Z",
                    "createdAt" => date('c'),
                    "targetYear" => null
                ]
            ];
            if (file_put_contents($users_file_path, json_encode($default_users, JSON_PRETTY_PRINT))) {
                $error_message = 'User data store initialized. Please try logging in again.';
            } else {
                $error_message = 'Critical: User data store not found and could not be initialized. Please contact support.';
            }
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - EduNexus (Static)</title>
    <link rel="stylesheet" href="../css/style.css">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
    <div class="form-container">
        <img src="../images/EduNexus-logo-black.jpg" alt="EduNexus Logo" style="display:block; margin:0 auto 1.5rem; width: 60px; height: auto;">
        <h2>Welcome Back!</h2>
        <p style="text-align:center; color: #7f8c8d; margin-bottom:1.5rem; font-size:0.9rem;">Enter your credentials to access your EduNexus account.</p>

        <?php if (!empty($error_message)): ?>
            <p class="error-message"><?php echo htmlspecialchars($error_message); ?></p>
        <?php endif; ?>

        <form method="POST" action="login.php">
            <div class="form-group">
                <label for="email">Email Address</label>
                <input type="email" id="email" name="email" required value="<?php echo isset($_POST['email']) ? htmlspecialchars($_POST['email']) : ''; ?>" placeholder="you@example.com">
            </div>
            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" required placeholder="••••••••">
            </div>
            <div class="form-group">
                <button type="submit">Log In</button>
            </div>
        </form>
        <div class="form-link">
            <p>Don't have an account? <a href="signup.php">Sign Up</a></p>
            <!-- <p><a href="#">Forgot Password?</a></p> -->
        </div>
    </div>
</body>
</html>
