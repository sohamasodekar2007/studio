<?php
session_start();
// Conceptual PHP script for signup.
// IMPORTANT: For a real application, this needs:
// 1. Reading/writing to users.json (create ../data/users.json if it doesn't exist).
// 2. Secure password hashing (e.g., password_hash()) - CRITICAL.
// 3. Thorough input validation and sanitization (prevent XSS, SQL injection if DB used).
// 4. Unique email check against existing users.
// 5. CSRF protection.
// 6. Generating truly unique user IDs (e.g., UUIDs).

$error_message = '';
$success_message = '';
$users_file_path = __DIR__ . '/../data/users.json';

// Ensure data directory exists
if (!is_dir(dirname($users_file_path))) {
    if (!mkdir(dirname($users_file_path), 0777, true) && !is_dir(dirname($users_file_path))) {
        $error_message = 'Failed to create data directory.'; // Stop if critical dir fails
    }
}


if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $name = trim($_POST['name'] ?? '');
    $email = trim(filter_var($_POST['email'] ?? '', FILTER_SANITIZE_EMAIL));
    $phone = trim($_POST['phone'] ?? '');
    $password = $_POST['password'] ?? '';
    $confirm_password = $_POST['confirm_password'] ?? '';
    // Added for new fields from Next.js form
    $academicStatus = $_POST['academicStatus'] ?? null;
    $targetYear = $_POST['targetYear'] ?? null;


    if (empty($name) || empty($email) || empty($phone) || empty($password) || empty($confirm_password) || empty($academicStatus) || empty($targetYear)) {
        $error_message = 'All fields are required.';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $error_message = 'Invalid email format.';
    } elseif (!preg_match('/^[0-9]{10}$/', $phone)) {
        $error_message = 'Phone number must be 10 digits.';
    } elseif (strlen($password) < 6) {
        $error_message = 'Password must be at least 6 characters long.';
    } elseif ($password !== $confirm_password) {
        $error_message = 'Passwords do not match.';
    } else {
        $users_array = [];
        if (file_exists($users_file_path)) {
            $users_data_json = file_get_contents($users_file_path);
            if (!empty($users_data_json)) {
                $users_array = json_decode($users_data_json, true);
                if (!is_array($users_array)) $users_array = [];
            }
        }

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
            // $hashed_password = password_hash($password, PASSWORD_DEFAULT); // Use this in production
            $hashed_password = $password; // Placeholder - insecure for production

            $new_user_id = 'user_' . time() . '_' . bin2hex(random_bytes(4)); // More unique ID

            $new_user = [
                'id' => $new_user_id,
                'name' => htmlspecialchars($name),
                'email' => $email,
                'phone' => htmlspecialchars($phone),
                'password' => $hashed_password, // Store HASHED password
                'role' => 'User',
                'class' => htmlspecialchars($academicStatus), // Store academic status
                'model' => 'free', // Default model
                'expiry_date' => null,
                'createdAt' => date('c'), // ISO 8601 date
                'targetYear' => htmlspecialchars($targetYear), // Store target year
                'avatarUrl' => null,
                'totalPoints' => 0,
                // Add other fields as necessary for your Next.js app features
            ];

            $users_array[] = $new_user;

            if (file_put_contents($users_file_path, json_encode($users_array, JSON_PRETTY_PRINT))) {
                $success_message = 'Account created successfully! You can now <a href="login.php">login</a>.';
                // To simulate welcome email (real app would use PHPMailer/SMTP)
                // mail($email, "Welcome to EduNexus!", "Thank you for registering...");
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
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
    <div class="form-container">
        <img src="../images/EduNexus-logo-black.jpg" alt="EduNexus Logo" style="display:block; margin:0 auto 1.5rem; width: 60px; height: auto;">
        <h2>Create your EduNexus Account</h2>
        <p style="text-align:center; color: #7f8c8d; margin-bottom:1.5rem; font-size:0.9rem;">Join our platform to start your exam preparation journey.</p>

        <?php if (!empty($error_message)): ?>
            <p class="error-message"><?php echo htmlspecialchars($error_message); ?></p>
        <?php endif; ?>
        <?php if (!empty($success_message)): ?>
            <p class="success-message"><?php echo $success_message; /* Allow HTML for link */ ?></p>
        <?php endif; ?>

        <?php if (empty($success_message)): // Hide form after success ?>
        <form method="POST" action="signup.php">
            <div class="form-group">
                <label for="name">Full Name</label>
                <input type="text" id="name" name="name" required value="<?php echo isset($_POST['name']) ? htmlspecialchars($_POST['name']) : ''; ?>" placeholder="Your Full Name">
            </div>
            <div class="form-group">
                <label for="email">Email Address</label>
                <input type="email" id="email" name="email" required value="<?php echo isset($_POST['email']) ? htmlspecialchars($_POST['email']) : ''; ?>" placeholder="you@example.com">
            </div>
             <div class="form-group">
                <label for="phone">Phone Number (10 digits)</label>
                <input type="tel" id="phone" name="phone" pattern="[0-9]{10}" title="Please enter a 10-digit phone number" required value="<?php echo isset($_POST['phone']) ? htmlspecialchars($_POST['phone']) : ''; ?>" placeholder="9876543210">
            </div>
            <div class="form-group">
                <label for="academicStatus">Current Academic Status</label>
                <select id="academicStatus" name="academicStatus" required>
                    <option value="">Select Status...</option>
                    <option value="11th Class" <?php echo (isset($_POST['academicStatus']) && $_POST['academicStatus'] == '11th Class') ? 'selected' : ''; ?>>11th Class</option>
                    <option value="12th Class" <?php echo (isset($_POST['academicStatus']) && $_POST['academicStatus'] == '12th Class') ? 'selected' : ''; ?>>12th Class</option>
                    <option value="Dropper" <?php echo (isset($_POST['academicStatus']) && $_POST['academicStatus'] == 'Dropper') ? 'selected' : ''; ?>>Dropper</option>
                </select>
            </div>
            <div class="form-group">
                <label for="targetYear">Target Exam Year</label>
                <select id="targetYear" name="targetYear" required>
                    <option value="">Select Year...</option>
                    <?php
                        $current_year = date("Y");
                        for ($i = 0; $i < 5; $i++) {
                            $year_option = $current_year + $i;
                            $selected = (isset($_POST['targetYear']) && $_POST['targetYear'] == $year_option) ? 'selected' : '';
                            echo "<option value=\"$year_option\" $selected>$year_option</option>";
                        }
                    ?>
                </select>
            </div>
            <div class="form-group">
                <label for="password">Password (min. 6 characters)</label>
                <input type="password" id="password" name="password" required placeholder="Choose a strong password">
            </div>
            <div class="form-group">
                <label for="confirm_password">Confirm Password</label>
                <input type="password" id="confirm_password" name="confirm_password" required placeholder="Re-enter your password">
            </div>
            <div class="form-group">
                <button type="submit">Sign Up</button>
            </div>
        </form>
        <?php endif; ?>
        <div class="form-link">
            <p>Already have an account? <a href="login.php">Login</a></p>
        </div>
    </div>
</body>
</html>
