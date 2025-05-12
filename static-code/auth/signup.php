<?php
session_start();
// This is a conceptual PHP script. Real implementation would require:
// - Reading/writing to users.json (create ../data/users.json if it doesn't exist)
// - Secure password hashing (e.g., password_hash())
// - Thorough input validation and sanitization
// - Unique email check
// - CSRF protection
// - Generating unique user IDs

$error_message = '';
$success_message = '';

// Path to users.json
$users_file_path = __DIR__ . '/../data/users.json';

// Ensure data directory exists
if (!is_dir(__DIR__ . '/../data')) {
    mkdir(__DIR__ . '/../data', 0777, true);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $name = trim($_POST['name'] ?? '');
    $email = trim(filter_var($_POST['email'] ?? '', FILTER_SANITIZE_EMAIL));
    $phone = trim($_POST['phone'] ?? '');
    $password = $_POST['password'] ?? '';
    $confirm_password = $_POST['confirm_password'] ?? '';
    // Add other fields like class, target_year if needed in your form

    if (empty($name) || empty($email) || empty($phone) || empty($password) || empty($confirm_password)) {
        $error_message = 'All fields are required.';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $error_message = 'Invalid email format.';
    } elseif (strlen($password) < 6) {
        $error_message = 'Password must be at least 6 characters long.';
    } elseif ($password !== $confirm_password) {
        $error_message = 'Passwords do not match.';
    } else {
        $users_array = [];
        if (file_exists($users_file_path)) {
            $users_data_json = file_get_contents($users_file_path);
            if ($users_data_json) {
                $users_array = json_decode($users_data_json, true);
                if (!is_array($users_array)) $users_array = []; // Ensure it's an array
            }
        }

        // Check if email already exists
        $email_exists = false;
        foreach ($users_array as $user_record) {
            if (isset($user_record['email']) && strtolower($user_record['email']) === strtolower($email)) {
                $email_exists = true;
                break;
            }
        }

        if ($email_exists) {
            $error_message = 'An account with this email address already exists.';
        } else {
            // HASH THE PASSWORD securely
            $hashed_password = password_hash($password, PASSWORD_DEFAULT);
            
            // Generate a unique ID (simple example, consider UUIDs for production)
            $new_user_id = uniqid('user_', true);

            $new_user = [
                'id' => $new_user_id,
                'name' => htmlspecialchars($name), // Sanitize name
                'email' => $email,
                'phone' => htmlspecialchars($phone), // Sanitize phone
                'password' => $hashed_password,
                'role' => 'User', // Default role
                'class' => $_POST['academicStatus'] ?? null,
                'model' => 'free', // Default model
                'expiry_date' => null,
                'createdAt' => date('c'), // ISO 8601 date
                'targetYear' => $_POST['targetYear'] ?? null,
                // Add other fields as necessary
            ];

            $users_array[] = $new_user;

            if (file_put_contents($users_file_path, json_encode($users_array, JSON_PRETTY_PRINT))) {
                $success_message = 'Account created successfully! You can now login.';
                // Optionally: send a welcome email
                // header('Location: login.php'); // Redirect to login after success
                // exit;
            } else {
                $error_message = 'Failed to save user data. Please try again later or contact support.';
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
    <title>Sign Up - EduNexus (Static)</title>
    <link rel="stylesheet" href="../css/style.css">
</head>
<body>
    <div class="form-container">
        <h2>Create your EduNexus Account</h2>
        <?php if (!empty($error_message)): ?>
            <p style="color: red; text-align: center; background-color: #ffebee; padding: 10px; border-radius: 4px; border: 1px solid #e57373;"><?php echo htmlspecialchars($error_message); ?></p>
        <?php elseif (!empty($success_message)): ?>
            <p style="color: green; text-align: center; background-color: #e8f5e9; padding: 10px; border-radius: 4px; border: 1px solid #a5d6a7;"><?php echo htmlspecialchars($success_message); ?></p>
        <?php endif; ?>
        <form method="POST" action="signup.php">
            <div class="form-group">
                <label for="name">Full Name</label>
                <input type="text" id="name" name="name" required value="<?php echo isset($_POST['name']) ? htmlspecialchars($_POST['name']) : ''; ?>">
            </div>
            <div class="form-group">
                <label for="email">Email Address</label>
                <input type="email" id="email" name="email" required value="<?php echo isset($_POST['email']) ? htmlspecialchars($_POST['email']) : ''; ?>">
            </div>
             <div class="form-group">
                <label for="phone">Phone Number (10 digits)</label>
                <input type="tel" id="phone" name="phone" pattern="[0-9]{10}" title="Please enter a 10-digit phone number" required value="<?php echo isset($_POST['phone']) ? htmlspecialchars($_POST['phone']) : ''; ?>">
            </div>
            <!-- Add academicStatus and targetYear dropdowns if needed based on your Next.js form -->
            <div class="form-group">
                <label for="password">Password (min. 6 characters)</label>
                <input type="password" id="password" name="password" required>
            </div>
            <div class="form-group">
                <label for="confirm_password">Confirm Password</label>
                <input type="password" id="confirm_password" name="confirm_password" required>
            </div>
            <div class="form-group">
                <button type="submit">Sign Up</button>
            </div>
        </form>
        <div class="form-link">
            <p>Already have an account? <a href="login.php">Login</a></p>
        </div>
    </div>
</body>
</html>
