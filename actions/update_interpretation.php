<?php
    include('login.php');
    
    # Decode POSTed data
    $_R = JSON_decode($_REQUEST['data'], true);

    # Check if the user is the same as who logged in.  If not, exit.
    if($_SESSION['user_id'] != $_R['user_id']) {
        echo "Bad User";
        exit;
    } else {
        $user_id = $_SESSION['user_id'];
    }

    # Determine if interpretation is complete
    $iscomplete= intval($_R['changeprocess'] &&
                $_R['landuse_before_primary'] &&
                $_R['landuse_after_primary'] &&
                $_R['landcover_before_primary'] &&
                $_R['landcover_after_primary'] &&
                $_R['shape'] &&
                $_R['context'] &&
                $_R['trajectory']);

    # For each field in the interp_data table, check and see if a key=>value pair was POSTed
    $updates = [];
    $rs = $mysqli->query("SHOW COLUMNS FROM interpretations") or die($mysqli->error);
    while($r = $rs->fetch_assoc()) {
        $f = $r['Field'];
        if(array_key_exists($f, $_R)) {
            # Some simple type checking for data sanitation
            if((false!==strpos($r['Type'], 'int'))) {
                $updates[] = "$f=".intval($_R[$f]);
            } elseif((false!==strpos($r['Type'], 'decimal')) ||(false!==strpos($r['Type'], 'numeric')) ||(false!==strpos($r['Type'], 'float')) ||(false!==strpos($r['Type'], 'double'))) {
                $updates[] = "$f=".floatval($_R[$f]);
            } else { 
                $updates[] = "$f='".$mysqli->real_escape_string(strip_tags($_R[$f]))."'";
            }
        }
    }
    $updates = implode($updates, ", ");
        
    # If keys that match field names were found, update an interpretation
    if($updates && $_R['plot_id']) {
        $rs = $mysqli->query("REPLACE INTO interpretations SET iscomplete=$iscomplete, $updates") or die($mysqli->error);
    }
    
    #Return to the javascript whether or not the plot is done
    echo '{"iscomplete":' . $iscomplete . '}';

?>