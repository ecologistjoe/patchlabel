<?php
    include('login.php');

    
    $proj_rs = $mysqli->query("SELECT project_id FROM projects") or die($mysqli->error);
    
    while($proj = $proj_rs->fetch_assoc()) {
        
        echo $proj['project_code'];
        flush();
    
        $plots_rs = $mysqli->query("SELECT tsa, plotid FROM plots WHERE project_id = $proj[project_id]") or die($mysqli->error);
        
        $out = "PROJECT_ID,TSA,PLOTID\n";
        while($p = $plots_rs->fetch_assoc()) {
            $out .= "$proj[project_id],$p[tsa],$p[plotid]\n";
        }
        mkdir("/home/ltstorage/plots_files/prj_$proj[project_id]/");
        file_put_contents("/home/ltstorage/plots_files/prj_$proj[project_id]/plots.csv", $out);
    }
    
?>