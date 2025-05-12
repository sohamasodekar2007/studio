<?php
session_start();
// This is a conceptual PHP script. Real implementation would require:
// - Secure password hashing (e.g., password_hash() and password_verify())
// - Reading users from a data source (like ../data/users.json)
// - Proper input validation and sanitization
// - CSRF protection

$error_message = '';

// Path to users.json (adjust if your structure is different)
$users_file_path = __DIR__ . '/../data/users.json';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = trim($_POST['email'] ?? '');
    $password_attempt = $_POST['password'] ?? '';

    if (empty($email) || empty($password_attempt)) {
        $error_message = 'Email and password are required.';
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
                    // IMPORTANT: This assumes passwords in users.json are ALREADY HASHED
                    // For new signups, ensure you hash passwords before storing.
                    // Example: if (password_verify($password_attempt, $found_user['password'])) {
                    if ($password_attempt === $found_user['password']) { // Replace with password_verify for hashed passwords
                        $_SESSION['user_email'] = $found_user['email'];
                        $_SESSION['user_id'] = $found_user['id']; // Store user ID
                        $_SESSION['user_role'] = $found_user['role'] ?? 'User'; // Default to 'User' if not set
                        $_SESSION['user_name'] = $found_user['name'] ?? $found_user['email'];


                        if ($_SESSION['user_role'] === 'Admin') {
                            header('Location: ../admin/dashboard.php');
                        } else {
                            header('Location: ../index.html'); // Or user dashboard
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
            $error_message = 'User data store not found. Please contact support.';
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
</head>
<body>
    <div class="form-container">
        <h2>Login to EduNexus</h2>
        <?php if (!empty($error_message)): ?>
            <p style="color: red; text-align: center; background-color: #ffebee; padding: 10px; border-radius: 4px; border: 1px solid #e57373;"><?php echo htmlspecialchars($error_message); ?></p>
        <?php endif; ?>
        <form method="POST" action="login.php">
            <div class="form-group">
                <label for="email">Email Address</label>
                <input type="email" id="email" name="email" required value="<?php echo isset($_POST['email']) ? htmlspecialchars($_POST['email']) : ''; ?>">
            </div>
            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" required>
            </div>
            <div class="form-group">
                <button type="submit">Login</button>
            </div>
        </form>
        <div class="form-link">
            <p>Don't have an account? <a href="signup.php">Sign Up</a></p>
            <p><a href="forgot-password.php">Forgot Password?</a></p>
        </div>
    </div>
</body>
</html>
