dbname="tsne"

../ids.txt:
	awk '{print $$1}' ../hathidocvectorsstdlog.txt | head -1000001 > $@

db:
	mysql -e "CREATE DATABASE IF NOT EXISTS $(dbname)"
	mysql -e "CREATE TABLE points (ID VARCHAR(64), x FLOAT, y FLOAT, zoom SMALLINT, PRIMARY KEY (zoom,x,y)" $(dbname)
	mysql -e "LOAD DATA LOCAL INFILE points.txt INTO TABLE points FIELDS SEPARATED BY '\t'" $(dbname)
	touch $@
