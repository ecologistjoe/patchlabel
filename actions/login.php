<?php

    ini_set('display_errors',1);
    
    # output is UTF-8
    header("Content-Type: text/html; charset= UTF-8");
    
    # Link to the Database
    $mysqli = new mysqli('localhost', 'PatchLabelRobot', 'xxxxx', 'patchlabel') or die($mysqli->error);
	
    # Start session and try to login
    session_start();
    
    # (Re-)Login Attempt
    if($_POST['login_user']) {
        # Get login information from the database
        $user = $mysqli->real_escape_string($_POST['login_user']);
        $pass = $mysqli->real_escape_string(sha1($_POST['login_pass']));
        
        $rs = $mysqli->query("SELECT user_id, user_name, first_name, last_name, 2 as user_level FROM users WHERE user_name = '$user' AND password = '$pass'") or die($mysqli->error);
        
        if ($rs->num_rows == 1) {
            # User found
            $r = $rs->fetch_assoc();
            $_SESSION['user_id'] = $r['user_id'];
            $_SESSION['user_name'] = $r['user_name'];
            $_SESSION['user_fullname'] = "$r[first_name] $r[last_name]";
            $_SESSION['user_level'] = $r['user_level'];
        } else {
            # No such user
            $_SESSION['user_level'] = 0;
        }
    }
    
    # user_level is only set if logged in
    if (array_key_exists('user_level', $_SESSION)) {
        # Check to see if required user_level
        $required_user_level = array_key_exists('elevated', $_GET) ? 2 : 1;
        if($_SESSION['user_level'] >= $required_user_level)
            return;  
    }
?>
<!DOCTYPE html>
<head>
    <title>Patch Label Sign In</title>
    <style>
        #login {
            width:300px;
            margin:10% auto;
            font:normal .9em Arial;
            color:#06c
        }
        fieldset {
            border:1px solid #06c;
        }
        legend {
            font-size:1.5em;
            font-weight:bold;
        }
        label {
            display:block;
            margin:10px;
            clear:both;
            text-align:right;
        }
        input {
            float:right;
            margin:0 5px;
        }
        input[type=text], input[type=password] {
            width:150px;
        }
        input[type=submit] {
            color:#008;
        }
        
    </style>
</head>

<body>
<form id="login" action="" method="POST">
<fieldset><legend>Sign in:</legend>
	<label>Username: <input type="text" name="login_user" /></label>
	<label>Password: <input type="password" name="login_pass" /></label>
    <label> <input type="submit" name="login" value="Sign in &#x25ba; " /></label>
</fieldset>
</form>

</body>

<?php exit(); ?>