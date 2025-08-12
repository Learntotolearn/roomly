build:
	docker build -t roomly:latest .
cp_local:
# 	test -d node_modules && node_modules_bak
	rm -rf roomly.tar.gz 
	tar cvf roomly.tar.gz ~/roomly 
	scp -r roomly.tar.gz root@192.168.100.44:/tmp 
	ssh root@192.168.100.44 "cd /tmp && tar xvf roomly.tar.gz && cd /tmp/Users/mac-512/roomly && make build"